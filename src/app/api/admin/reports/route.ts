import { json, searchParams, staffRoute } from "@/lib/api";
import { can } from "@/lib/permissions";
import { forbidden } from "@/lib/server/errors";
import { listMovements } from "@/lib/server/inventory";
import { listPurchases } from "@/lib/server/purchases";
import { collections, dailyChannels, expenseByCategory, parsePeriod, productSales, salesSummary, toCsv } from "@/lib/server/reports";

/**
 * ?type=summary|products|payments|daily|expenses|purchases|movements &from=&to=&channel= &format=csv
 * Profit/cost figures need reports.financial (owner by default).
 */
export const GET = staffRoute("reports.sales", async (req, { db, actor }) => {
  const sp = searchParams(req);
  const p = parsePeriod(sp);
  const type = sp.get("type") ?? "summary";
  const fin = can(actor.role, "reports.financial");
  const csv = sp.get("format") === "csv";
  const send = (name: string, rows: Record<string, unknown>[], data: Record<string, unknown>) =>
    csv
      ? new Response(toCsv(rows), {
          headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}-${p.from}-to-${p.to}${p.channel ? `-${p.channel}` : ""}.csv"` },
        })
      : json(data);

  switch (type) {
    case "summary": {
      const s = await salesSummary(db, p);
      const out = fin ? s : { ...s, cogs: null, grossProfit: null, grossMarginPct: null, expenses: null, estimatedOperatingProfit: null, missingCost: null };
      return send("summary", [out as unknown as Record<string, unknown>], { summary: out });
    }
    case "products": {
      const rows = await productSales(db, p);
      const out = fin ? rows : rows.map(({ cogs: _c, profit: _p, missing_cost: _m, ...r }) => r);
      return send("product-sales", out as Record<string, unknown>[], { rows: out });
    }
    case "payments": {
      const rows = await collections(db, p);
      return send("payment-methods", rows as unknown as Record<string, unknown>[], { rows });
    }
    case "daily": {
      const rows = await dailyChannels(db, p);
      const out = fin ? rows : rows.map(({ cogs: _c, ...r }) => r);
      return send("online-vs-offline", out as Record<string, unknown>[], { rows: out });
    }
    case "expenses": {
      if (!fin && !can(actor.role, "expenses.manage")) throw forbidden();
      const rows = await expenseByCategory(db, p);
      return send("expenses", rows as unknown as Record<string, unknown>[], { rows });
    }
    case "purchases": {
      if (!can(actor.role, "purchases.create")) throw forbidden();
      const rows = await listPurchases(db, { from: p.from, to: p.to, limit: 500 });
      return send("purchases", rows as unknown as Record<string, unknown>[], { rows });
    }
    case "movements": {
      if (!can(actor.role, "inventory.view")) throw forbidden();
      const rows = await listMovements(db, { from: p.from, to: p.to, limit: 1000 });
      return send("stock-movements", rows as unknown as Record<string, unknown>[], { rows });
    }
  }
  return json({ error: "Unknown report" }, 400);
});
