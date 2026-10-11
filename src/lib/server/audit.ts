import type { Queryable } from "@/lib/db/adapter";
import { whereBuilder } from "@/lib/db/where";
import type { Actor } from "@/lib/permissions";

/**
 * Appends one audit record. Call it inside the same transaction as the change so the log and
 * the data can never disagree. The table is append-only (a DB trigger blocks UPDATE/DELETE).
 */
export async function audit(
  q: Queryable,
  actor: Actor,
  action: string,
  entity: { type: string; id: string },
  summary: string,
  details?: unknown,
) {
  await q.query(
    `insert into audit_logs (user_id, user_name, role, action, entity_type, entity_id, summary, details)
     values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [actor.id, actor.name, actor.role, action, entity.type, entity.id, summary.slice(0, 500), details === undefined ? null : JSON.stringify(details)],
  );
}

export interface AuditRow {
  id: number;
  at: string;
  user_name: string;
  role: string;
  action: string;
  entity_type: string;
  entity_id: string;
  summary: string;
  details: unknown;
}

export async function listAudit(
  q: Queryable,
  f: { action?: string; entity?: string; user?: string; from?: string; to?: string; search?: string; limit?: number; before?: number },
) {
  const w = whereBuilder();
  if (f.action) w.add("action like ?", `${f.action}%`);
  if (f.entity) w.add("entity_type = ?", f.entity);
  if (f.user) w.add("user_name ilike ?", `%${f.user}%`);
  if (f.from) w.add("ist_date(at) >= ?::date", f.from);
  if (f.to) w.add("ist_date(at) <= ?::date", f.to);
  if (f.search) w.add("(summary ilike ? or entity_id ilike ?)", `%${f.search}%`, `%${f.search}%`);
  if (f.before) w.add("id < ?", f.before);
  const limit = w.param(Math.min(f.limit ?? 100, 500));
  return q.query<AuditRow>(
    `select id, at, user_name, role, action, entity_type, entity_id, summary, details from audit_logs
     ${w.sql} order by id desc limit ${limit}`,
    w.params,
  );
}
