import type { Queryable } from "@/lib/db/adapter";
import { can, type Actor } from "@/lib/permissions";
import { collections, expiringSoon, lowStock, pendingWork, productSales, recentPurchases, salesSummary, stockValuation, todayIST, type Period } from "./reports";
import { getSettings } from "./settings";

/** Everything the owner dashboard shows, filtered by what the viewer may see. Polled every ~20 s. */
export async function dashboardData(q: Queryable, actor: Actor, p: Period) {
  const fin = can(actor.role, "reports.financial");
  const seeSales = can(actor.role, "reports.sales");
  const s = await getSettings(q);

  if (!seeSales) {
    // cashier / inventory staff: just their own work for today + stock alerts
    const mine = await q.query<{ bills: number; total: number }>(
      "select count(*)::int as bills, coalesce(sum(total),0) as total from sales where cashier_id = $1 and ist_date(created_at) = $2::date and channel = 'OFFLINE'",
      [actor.id, todayIST()],
    );
    return {
      limited: true as const,
      mine: mine[0],
      lowStock: can(actor.role, "inventory.view") || can(actor.role, "products.view") ? await lowStock(q, 15) : [],
      pending: await pendingWork(q),
      generatedAt: new Date().toISOString(),
    };
  }

  const [summary, pay, top, low, stock, pending, purchases, expiring] = await Promise.all([
    salesSummary(q, p),
    collections(q, p),
    productSales(q, { ...p, limit: 8 }),
    lowStock(q, 12),
    stockValuation(q),
    pendingWork(q),
    can(actor.role, "purchases.create") ? recentPurchases(q, 6) : Promise.resolve([]),
    expiringSoon(q, s.operations.expiryAlertDays, 8),
  ]);
  return {
    limited: false as const,
    summary: fin ? summary : { ...summary, cogs: null, grossProfit: null, grossMarginPct: null, expenses: null, estimatedOperatingProfit: null, missingCost: null },
    collections: pay,
    topProducts: fin ? top : top.map(({ cogs: _c, profit: _p, ...r }) => r),
    lowStock: low,
    stock: fin ? stock : { ...stock, cost_value: null },
    pending,
    recentPurchases: purchases,
    expiring,
    generatedAt: new Date().toISOString(),
  };
}

export type DashboardData = Awaited<ReturnType<typeof dashboardData>>;
