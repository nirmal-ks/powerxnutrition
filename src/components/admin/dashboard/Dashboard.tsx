"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { inr2 } from "@/lib/money";
import type { DashboardData } from "@/lib/server/dashboard";
import { useActor, useCan } from "../SessionContext";
import { Alert, Card, Empty, fmtDay, Freshness, istToday, PeriodFilter, Stat, useApi } from "../ui";

const METHOD: Record<string, string> = { cash: "Cash", upi: "UPI", card: "Card", other: "Other", cod: "COD", razorpay: "Online gateway" };

export function Dashboard() {
  const actor = useActor();
  const can = useCan();
  const [p, setP] = useState({ from: istToday(), to: istToday(), channel: "" });
  const url = useMemo(() => `/api/admin/dashboard?${new URLSearchParams(p)}`, [p]);
  // live: re-polls every 20 s and when the tab regains focus, so other devices' sales appear
  const { data, error, reload, updatedAt } = useApi<DashboardData>(url, { pollMs: 20_000 });
  const today = p.from === p.to && p.from === istToday();
  const label = today ? "Today" : p.from === p.to ? fmtDay(p.from) : `${fmtDay(p.from)} – ${fmtDay(p.to)}`;

  if (data?.limited) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="font-display text-4xl">Hi {actor.name.split(" ")[0]} 👋</h1>
            <Freshness at={updatedAt} error={error} onRefresh={reload} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {can("sales.create") && (
            <Link href="/admin/sales/new" className="rounded-2xl border border-blood/40 bg-blood/15 p-6 text-center">
              <p className="font-display text-3xl">+ New bill</p>
              <p className="text-sm text-zinc-300">Open the POS</p>
            </Link>
          )}
          {can("purchases.create") && (
            <Link href="/admin/inventory/stock-in" className="rounded-2xl border border-gold/40 bg-gold/10 p-6 text-center">
              <p className="font-display text-3xl">Receive stock</p>
              <p className="text-sm text-zinc-300">Delivery arrived</p>
            </Link>
          )}
          {can("sales.create") && <Stat label="Your bills today" value={data.mine.bills} hint={inr2(data.mine.total)} />}
        </div>
        <LowStock rows={data.lowStock} />
      </div>
    );
  }

  const s = data?.summary;
  const fin = can("reports.financial");
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl">Dashboard</h1>
          <Freshness at={updatedAt} error={error} onRefresh={reload} />
        </div>
        <div className="flex gap-2">
          {can("sales.create") && <Link href="/admin/sales/new" className="btn btn-red px-4! py-2.5! text-sm!">+ New bill</Link>}
          {can("purchases.create") && <Link href="/admin/inventory/stock-in" className="btn btn-ghost px-4! py-2.5! text-sm!">Receive stock</Link>}
        </div>
      </div>
      <PeriodFilter {...p} onChange={setP} />
      {error && !data && <Alert>{error}</Alert>}
      {!data ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/5" />)}</div>
      ) : (
        <>
          <Pending d={data} />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label={`${label} · Online`} value={inr2(s!.onlineTotal)} hint={`${s!.onlineBills} order(s)`} tone="text-blue-300" href="/admin/orders" />
            <Stat label={`${label} · Shop`} value={inr2(s!.offlineTotal)} hint={`${s!.offlineBills} bill(s)`} tone="text-purple-300" href="/admin/sales" />
            <Stat label="Combined (billed, incl. GST)" value={inr2(s!.billedTotal)} hint={`${s!.bills} sale(s) · ${s!.unitsSold} unit(s)`} tone="text-gold" />
            <Stat label="Net sales (excl. GST, after returns)" value={inr2(s!.netSales)} hint={s!.returns.count ? `${s!.returns.count} return(s) −${inr2(s!.returns.value)}` : "No returns"} />
            {fin && (
              <>
                <Stat label="Gross profit" value={inr2(s!.grossProfit ?? 0)} hint={`${s!.grossMarginPct}% margin · COGS ${inr2(s!.cogs ?? 0)}`} tone="text-green-300" />
                <Stat label="Recorded expenses" value={inr2(s!.expenses ?? 0)} hint={`${s!.expenseCount} entr${s!.expenseCount === 1 ? "y" : "ies"}`} href="/admin/expenses" />
                <Stat
                  label="Est. operating profit"
                  value={inr2(s!.estimatedOperatingProfit ?? 0)}
                  hint="Gross profit − recorded expenses only"
                  tone={(s!.estimatedOperatingProfit ?? 0) >= 0 ? "text-green-300" : "text-ember"}
                />
                <Stat label="Stock value (at cost)" value={inr2(data.stock.cost_value ?? 0)} hint={`Retail ${inr2(data.stock.retail_value)} · not profit`} href="/admin/inventory" />
              </>
            )}
          </div>
          {fin && s!.missingCost && s!.missingCost.units > 0 && (
            <Alert tone="warn">
              {s!.missingCost.units} unit(s) sold in this period have <b>no purchase cost recorded</b> (old opening stock), so gross profit is overstated by up to {inr2(s!.missingCost.salesValue)}. Set costs in Products, or receive stock through Purchases.
            </Alert>
          )}

          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="Money collected">
              {data.collections.length ? (
                <ul className="space-y-2 text-sm">
                  {data.collections.map((c) => (
                    <li key={c.method} className="flex items-center justify-between gap-2">
                      <span>{METHOD[c.method] ?? c.method} <span className="text-xs text-smoke">({c.count})</span></span>
                      <span className="text-right">
                        <b>{inr2(c.net)}</b>
                        {c.refunded > 0 && <span className="block text-[0.7rem] text-ember">refunds −{inr2(c.refunded)}</span>}
                        {c.pending > 0 && <span className="block text-[0.7rem] text-gold">{inr2(c.pending)} pending</span>}
                      </span>
                    </li>
                  ))}
                  <li className="flex justify-between border-t border-white/8 pt-2 font-bold"><span>Total</span><span className="text-gold">{inr2(data.collections.reduce((x, c) => x + c.net, 0))}</span></li>
                </ul>
              ) : (
                <Empty>No payments yet in this period.</Empty>
              )}
              <p className="mt-2 text-[0.7rem] text-smoke">Shop UPI/card = recorded by cashier. “Online gateway” = verified by Razorpay.</p>
            </Card>
            <Card title="Top products" action={<Link href="/admin/reports" className="text-xs font-bold text-gold">Reports →</Link>}>
              {data.topProducts.length ? (
                <ul className="space-y-1.5 text-sm">
                  {data.topProducts.map((t) => (
                    <li key={t.variant_id} className="flex justify-between gap-2">
                      <span className="truncate">{t.product_name} <span className="text-smoke">({t.variant_label})</span></span>
                      <b className="shrink-0">{t.qty - t.returned}×</b>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>Nothing sold yet.</Empty>
              )}
            </Card>
            <LowStock rows={data.lowStock} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {data.expiring.length > 0 && (
              <Card title="Expiring soon" action={<Link href="/admin/inventory?tab=batches" className="text-xs font-bold text-gold">Batches →</Link>}>
                <ul className="space-y-1.5 text-sm">
                  {data.expiring.map((b) => (
                    <li key={b.batch_id} className="flex justify-between gap-2">
                      <span className="truncate">{b.name} <span className="text-smoke">({b.label}{b.batch_no ? ` · ${b.batch_no}` : ""})</span></span>
                      <span className={b.days_left < 0 ? "font-bold text-ember" : b.days_left <= 30 ? "font-bold text-gold" : "text-zinc-300"}>
                        {b.qty_remaining} · {b.days_left < 0 ? "EXPIRED" : `${b.days_left}d`}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            {data.recentPurchases.length > 0 && (
              <Card title="Recent purchases" action={<Link href="/admin/purchases" className="text-xs font-bold text-gold">All →</Link>}>
                <ul className="space-y-1.5 text-sm">
                  {data.recentPurchases.map((r) => (
                    <li key={r.id}>
                      <Link href={`/admin/purchases/${r.id}`} className="flex justify-between gap-2 hover:text-gold">
                        <span className="truncate">{r.purchase_no} · {r.supplier_name} <span className="text-smoke">({r.units} units)</span></span>
                        <span className={r.status === "draft" ? "text-gold" : ""}>{r.status === "draft" ? "Draft" : inr2(r.total)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Pending({ d }: { d: Extract<DashboardData, { limited: false }> }) {
  const can = useCan();
  const items = [
    can("orders.manage") && d.pending.new_orders > 0 && { href: "/admin/orders?status=new", text: `${d.pending.new_orders} new online order(s)` },
    can("orders.manage") && d.pending.upi_verify > 0 && { href: "/admin/orders?payment=verifying", text: `${d.pending.upi_verify} UPI payment(s) to verify` },
    can("purchases.create") && d.pending.invoices > 0 && { href: "/admin/purchases/import-invoice", text: `${d.pending.invoices} supplier invoice(s) to review` },
    can("purchases.create") && d.pending.drafts > 0 && { href: "/admin/purchases?status=draft", text: `${d.pending.drafts} draft purchase(s) not confirmed` },
    can("images.review") && d.pending.images > 0 && { href: "/admin/images", text: `${d.pending.images} product(s) awaiting photo approval` },
    can("products.edit") && d.pending.draft_products > 0 && { href: "/admin/products?filter=draft", text: `${d.pending.draft_products} new product(s) not yet published` },
  ].filter(Boolean) as { href: string; text: string }[];
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((i) => (
        <Link key={i.href} href={i.href} className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-bold text-gold hover:border-gold">
          ● {i.text} →
        </Link>
      ))}
    </div>
  );
}

function LowStock({ rows }: { rows: { variant_id: string; slug: string; name: string; label: string; flavour: string; stock: number; min_stock: number }[] }) {
  return (
    <Card title="Low stock" action={<Link href="/admin/inventory?low=1" className="text-xs font-bold text-gold">All →</Link>}>
      {rows.length ? (
        <ul className="space-y-1.5 text-sm">
          {rows.map((r) => (
            <li key={r.variant_id} className="flex items-center justify-between gap-2">
              <span className="truncate">{r.name} <span className="text-smoke">({[r.label, r.flavour].filter(Boolean).join(", ")})</span></span>
              <span className={r.stock <= 0 ? "font-bold text-ember" : "font-bold text-gold"}>{r.stock <= 0 ? "Out" : r.stock}</span>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>All good — nothing is running low.</Empty>
      )}
    </Card>
  );
}
