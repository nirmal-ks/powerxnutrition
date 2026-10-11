import "server-only";
import path from "node:path";
import { createPgliteDb, createPostgresDb, type Db } from "./adapter";
import { migrations } from "./migrations";
import { databaseUrl } from "@/lib/env";

export type { Db, Queryable, Row } from "./adapter";
export { newId, nextCounter, nextDocumentNo, financialYear } from "./ids";

/**
 * Database selection:
 *  - DATABASE_URL set  → hosted Postgres (Supabase "Session pooler" / "Transaction pooler" URI, Neon, …)
 *  - otherwise         → PGlite in ./data/db (or PGLITE_DATA_DIR). Needs a writable disk.
 * The instance lives on globalThis so Next.js hot reloads don't open the same files twice.
 */
type DbGlobal = { __pxDb?: Promise<Db> };
const g = globalThis as DbGlobal;

export const dbKind = (): "postgres" | "pglite" => (databaseUrl() ? "postgres" : "pglite");

/** True while `next build` is prerendering. PGlite is single-process, so we don't open it then. */
export const isBuildPhase = () => process.env.NEXT_PHASE === "phase-production-build";

export function getDb(): Promise<Db> {
  if (!g.__pxDb) {
    g.__pxDb = (async () => {
      const url = databaseUrl();
      const db = url
        ? await createPostgresDb(url)
        : await createPgliteDb(process.env.PGLITE_DATA_DIR || path.join(process.cwd(), "data", "db"));
      await migrate(db);
      const { seedIfEmpty } = await import("./seed");
      await seedIfEmpty(db);
      return db;
    })().catch((e) => {
      g.__pxDb = undefined; // allow a retry on the next request
      throw e;
    });
  }
  return g.__pxDb;
}

/** Applies pending migrations inside a transaction each. Safe to call repeatedly. */
export async function migrate(db: Db) {
  await db.exec(`create table if not exists schema_migrations (
    version text primary key, name text not null, applied_at timestamptz not null default now())`);
  // Serialise concurrent cold starts (several serverless instances) on Postgres.
  const lock = db.kind === "postgres" ? "select pg_advisory_xact_lock(777001)" : "";
  for (const m of migrations) {
    await db.tx(async (q) => {
      if (lock) await q.query(lock);
      const done = await q.query("select 1 from schema_migrations where version = $1", [m.version]);
      if (done.length) return;
      await q.exec(m.sql);
      await q.query("insert into schema_migrations (version, name) values ($1, $2)", [m.version, m.name]);
    });
  }
}
