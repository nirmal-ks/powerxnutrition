import { json, searchParams, staffRoute } from "@/lib/api";
import { listAudit } from "@/lib/server/audit";
import { toCsv } from "@/lib/server/reports";

/** Read-only. There is deliberately no update/delete endpoint (and the table rejects them). */
export const GET = staffRoute("audit.view", async (req, { db }) => {
  const sp = searchParams(req);
  const rows = await listAudit(db, {
    action: sp.get("action") ?? undefined,
    entity: sp.get("entity") ?? undefined,
    user: sp.get("user") ?? undefined,
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
    search: sp.get("q") ?? undefined,
    before: Number(sp.get("before")) || undefined,
    limit: sp.get("format") === "csv" ? 500 : 100,
  });
  if (sp.get("format") === "csv") {
    return new Response(toCsv(rows as unknown as Record<string, unknown>[]), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="activity-log.csv"' },
    });
  }
  return json({ logs: rows });
});
