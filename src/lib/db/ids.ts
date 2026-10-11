import type { Queryable } from "./adapter";

export const newId = () => crypto.randomUUID();

/** Next value of a named counter, atomically (inside the caller's transaction). */
export async function nextCounter(q: Queryable, key: string): Promise<number> {
  const rows = await q.query<{ value: number }>(
    `insert into counters (key, value) values ($1, 1)
     on conflict (key) do update set value = counters.value + 1
     returning value`,
    [key],
  );
  return rows[0].value;
}

/** Indian financial year label for a date, e.g. 2026-10-11 → "26-27". April starts a new year. */
export function financialYear(d = new Date()) {
  const ist = new Date(d.getTime() + 330 * 60_000);
  const y = ist.getUTCFullYear();
  const start = ist.getUTCMonth() >= 3 ? y : y - 1;
  return `${String(start).slice(2)}-${String(start + 1).slice(2)}`;
}

/** "PX/26-27/00042" — unique, gap-free per financial year and series (GST rule: ≤16 chars). */
export async function nextDocumentNo(q: Queryable, series: string, prefix: string, d = new Date()) {
  const fy = financialYear(d);
  const n = await nextCounter(q, `${series}:${prefix}:${fy}`);
  return `${prefix}/${fy}/${String(n).padStart(5, "0")}`;
}
