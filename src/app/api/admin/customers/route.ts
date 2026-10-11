import { json, searchParams, staffRoute } from "@/lib/api";
import { listCustomers } from "@/lib/server/customers";
import { toCsv } from "@/lib/server/reports";

export const GET = staffRoute("customers.view", async (req, { db }) => {
  const sp = searchParams(req);
  const rows = await listCustomers(db, { search: sp.get("q") ?? undefined, limit: sp.get("format") === "csv" ? 500 : 100 });
  if (sp.get("format") === "csv") {
    return new Response(toCsv(rows.map(({ address: _a, ...r }) => r) as unknown as Record<string, unknown>[]), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="customers.csv"' },
    });
  }
  return json({ customers: rows });
});
