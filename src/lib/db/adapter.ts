/**
 * One tiny interface over two Postgres engines:
 *  - PGlite: real Postgres compiled to WebAssembly, runs inside Node and stores its files in
 *    data/db. Zero setup, free, used locally / on any Node host with a disk, and in tests.
 *  - node-postgres (`pg`): any hosted Postgres (Supabase free tier, Neon, RDS…) via DATABASE_URL.
 *    Required on Vercel / serverless hosts (no writable disk).
 * Both get the same SQL, the same migrations and the same type parsing, so business logic
 * is written once and transactions/row locks behave identically.
 */

export type Row = Record<string, unknown>;

export interface Queryable {
  query<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Runs a multi-statement SQL script (migrations). No parameters. */
  exec(sql: string): Promise<void>;
}

export interface Db extends Queryable {
  kind: "pglite" | "postgres";
  /** Runs fn inside BEGIN/COMMIT; any throw rolls everything back. */
  tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

// Postgres type OIDs we normalise so both drivers return the same JS values.
const NUMERIC = 1700;
const INT8 = 20;
const DATE = 1082;
const TIMESTAMPTZ = 1184;
const TIMESTAMP = 1114;

const toIso = (v: string) => {
  // Postgres text format: "2026-10-11 09:12:33.123+00" → ISO 8601
  const d = new Date(v.replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00"));
  return Number.isNaN(d.getTime()) ? v : d.toISOString();
};

export const parsers: Record<number, (v: string) => unknown> = {
  [NUMERIC]: (v) => Number(v),
  [INT8]: (v) => Number(v),
  [DATE]: (v) => v, // keep "YYYY-MM-DD" as a string — no timezone surprises
  [TIMESTAMPTZ]: toIso,
  [TIMESTAMP]: toIso,
};

export async function createPgliteDb(dataDir?: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = new PGlite({ ...(dataDir ? { dataDir } : {}), parsers });
  await pg.waitReady;
  return {
    kind: "pglite",
    async query<T>(sql: string, params: unknown[] = []) {
      const res = await pg.query<T>(sql, params);
      return res.rows;
    },
    async exec(sql: string) {
      await pg.exec(sql);
    },
    async tx<T>(fn: (q: Queryable) => Promise<T>) {
      return pg.transaction(async (t) =>
        fn({
          async query<R>(sql: string, params: unknown[] = []) {
            return (await t.query<R>(sql, params)).rows;
          },
          async exec(sql: string) {
            await t.exec(sql);
          },
        }),
      );
    },
    close: () => pg.close(),
  };
}

export async function createPostgresDb(connectionString: string): Promise<Db> {
  const { default: pg } = await import("pg");
  for (const [oid, fn] of Object.entries(parsers)) pg.types.setTypeParser(Number(oid), fn);
  const pool = new pg.Pool({
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX) || 5,
    // Supabase / most hosted Postgres require TLS; local postgres usually doesn't.
    ssl: /localhost|127\.0\.0\.1/.test(connectionString) || /sslmode=disable/.test(connectionString) ? undefined : { rejectUnauthorized: false },
  });
  return {
    kind: "postgres",
    async query<T>(sql: string, params: unknown[] = []) {
      return (await pool.query(sql, params)).rows as T[];
    },
    async exec(sql: string) {
      await pool.query(sql);
    },
    async tx<T>(fn: (q: Queryable) => Promise<T>) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const out = await fn({
          query: async <R>(sql: string, params: unknown[] = []) => (await client.query(sql, params)).rows as R[],
          exec: async (sql: string) => {
            await client.query(sql);
          },
        });
        await client.query("COMMIT");
        return out;
      } catch (e) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw e;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}
