import { json, searchParams, staffRoute } from "@/lib/api";
import { can } from "@/lib/permissions";
import { inventoryOverview, listBatches, listMovements } from "@/lib/server/inventory";
import { stockValuation, toCsv } from "@/lib/server/reports";

/** ?view=stock (default) | movements | batches ; &format=csv to download. Cost columns need reports.financial / products.cost. */
export const GET = staffRoute("inventory.view", async (req, { db, actor }) => {
  const sp = searchParams(req);
  const view = sp.get("view") ?? "stock";
  const seeCost = can(actor.role, "products.cost");
  const csv = sp.get("format") === "csv";

  if (view === "movements") {
    const rows = await listMovements(db, {
      variantId: sp.get("variant") ?? undefined,
      type: sp.get("type") ?? undefined,
      from: sp.get("from") ?? undefined,
      to: sp.get("to") ?? undefined,
      search: sp.get("q") ?? undefined,
      limit: csv ? 1000 : Number(sp.get("limit")) || 100,
      offset: Number(sp.get("offset")) || 0,
    });
    if (csv) return new Response(toCsv(rows as unknown as Record<string, unknown>[]), { headers: csvHeaders("stock-movements") });
    return json({ movements: rows });
  }
  if (view === "batches") {
    const rows = await listBatches(db, { variantId: sp.get("variant") ?? undefined, expiringDays: Number(sp.get("expiring")) || undefined });
    const out = seeCost ? rows : rows.map(({ unit_cost: _c, ...r }) => r);
    if (csv) return new Response(toCsv(out as unknown as Record<string, unknown>[]), { headers: csvHeaders("batches") });
    return json({ batches: out });
  }
  const rows = await inventoryOverview(db, {
    search: sp.get("q") ?? undefined,
    brand: sp.get("brand") ?? undefined,
    category: sp.get("category") ?? undefined,
    supplierId: sp.get("supplier") ?? undefined,
    low: sp.get("low") === "1",
    expiringDays: Number(sp.get("expiring")) || undefined,
  });
  const out = seeCost ? rows : rows.map(({ avg_cost: _c, ...r }) => r);
  if (csv) {
    const withValues = out.map((r) => ({
      ...r,
      ...(seeCost ? { stock_value_at_cost: Math.round(Math.max(0, r.stock) * Number((r as { avg_cost?: number }).avg_cost ?? 0) * 100) / 100 } : {}),
      retail_value: Math.max(0, r.stock) * r.price,
    }));
    return new Response(toCsv(withValues as unknown as Record<string, unknown>[]), { headers: csvHeaders("inventory") });
  }
  return json({ items: out, valuation: can(actor.role, "reports.financial") ? await stockValuation(db) : null, checkedAt: new Date().toISOString() });
});

const csvHeaders = (name: string) => ({
  "Content-Type": "text/csv; charset=utf-8",
  "Content-Disposition": `attachment; filename="${name}-${new Date().toISOString().slice(0, 10)}.csv"`,
});
