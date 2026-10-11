"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { cn } from "@/lib/format";
import { inr2 } from "@/lib/money";
import { useCan } from "./SessionContext";
import { Alert, Card, Empty, fmtDate, fmtDay, istDaysAgo, istToday, PeriodFilter, Spinner, Stat, useApi } from "./ui";

type Tab = "summary" | "products" | "daily" | "payments" | "expenses" | "purchases" | "movements";
type Summary = {
  bills: number; onlineBills: number; offlineBills: number; grossSales: number; discounts: number; taxCollected: number; delivery: number; billedTotal: number;
  onlineTotal: number; offlineTotal: number; returns: { count: number; units: number; value: number; refunds: number }; unitsSold: number; netSales: number;
  cogs: number | null; grossProfit: number | null; grossMarginPct: number | null; missingCost: { units: number; salesValue: number } | null; expenses: number | null; expenseCount: number; estimatedOperatingProfit: number | null;
};

const METHOD: Record<string, string> = { cash: "Cash", upi: "UPI", card: "Card", other: "Other", cod: "Cash on delivery", razorpay: "Online gateway (Razorpay)" };

export function ReportsView() {
  const can = useCan();
  const fin = can("reports.financial");
  const [p, setP] = useState({ from: istDaysAgo(29), to: istToday(), channel: "" });
  const [tab, setTab] = useState<Tab>("summary");
  const qs = useMemo(() => new URLSearchParams({ ...p, type: tab }).toString(), [p, tab]);
  const { data, error, loading } = useApi<Record<string, unknown>>(`/api/admin/reports?${qs}`);
  const csv = `/api/admin/reports?${qs}&format=csv`;
  const tabs: [Tab, string, boolean][] = [
    ["summary", "Profit & sales", true],
    ["products", "Product-wise", true],
    ["daily", "Online vs shop", true],
    ["payments", "Payment methods", true],
    ["expenses", "Expenses", fin || can("expenses.manage")],
    ["purchases", "Purchases", can("purchases.create")],
    ["movements", "Stock movements", can("inventory.view")],
  ];

  return (
    <div className="space-y-4">
      <PeriodFilter {...p} onChange={setP} showChannel={!["expenses", "purchases", "movements"].includes(tab)} />
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
        {tabs.filter((t) => t[2]).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={cn("shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold", tab === id ? "border-transparent bg-blood text-white" : "border-white/10 text-zinc-400")}>{label}</button>
        ))}
        <a href={csv} className="ml-auto shrink-0 rounded-full border border-gold/40 px-3 py-1.5 text-xs font-bold text-gold">⬇ Download CSV</a>
      </div>
      {error && <Alert>{error}</Alert>}
      {loading && !data && <p className="p-8 text-center"><Spinner /></p>}

      {tab === "summary" && data?.summary ? <SummaryView s={data.summary as Summary} fin={fin} /> : null}

      {tab === "products" && Array.isArray(data?.rows) && (
        <Table
          rows={data.rows as Record<string, number | string | boolean>[]}
          cols={[
            ["product_name", "Product", (r) => <>{String(r.product_name)} <span className="text-smoke">({String(r.variant_label)})</span>{r.missing_cost ? <span className="ml-1 text-gold" title="No purchase cost recorded">⚠</span> : null}</>],
            ["qty", "Sold", (r) => <>{Number(r.qty) - Number(r.returned)}{Number(r.returned) ? <span className="text-xs text-smoke"> ({String(r.returned)} returned)</span> : null}</>],
            ["net_sales", "Net sales (excl. GST)", (r) => inr2(Number(r.net_sales))],
            ...(fin ? ([["cogs", "Cost", (r) => inr2(Number(r.cogs))], ["profit", "Gross profit", (r) => <b className={Number(r.profit) >= 0 ? "text-green-300" : "text-ember"}>{inr2(Number(r.profit))}</b>]] as Col[]) : []),
          ]}
        />
      )}

      {tab === "daily" && Array.isArray(data?.rows) && <Daily rows={data.rows as { day: string; online: number; offline: number; online_bills: number; offline_bills: number; net_sales: number; cogs?: number }[]} fin={fin} />}

      {tab === "payments" && Array.isArray(data?.rows) && (
        <>
          <Table
            rows={data.rows as Record<string, number | string>[]}
            cols={[
              ["method", "Method", (r) => METHOD[String(r.method)] ?? String(r.method)],
              ["count", "Payments", (r) => String(r.count)],
              ["received", "Received", (r) => inr2(Number(r.received))],
              ["refunded", "Refunded", (r) => (Number(r.refunded) ? <span className="text-ember">−{inr2(Number(r.refunded))}</span> : "—")],
              ["net", "Net collected", (r) => <b>{inr2(Number(r.net))}</b>],
              ["pending", "Still pending", (r) => (Number(r.pending) ? <span className="text-gold">{inr2(Number(r.pending))}</span> : "—")],
            ]}
          />
          <p className="text-xs text-smoke">Shop UPI/card payments are recorded by the cashier; only “Online gateway” payments are verified by the gateway. COD shows as pending until the order is marked paid.</p>
        </>
      )}

      {tab === "expenses" && Array.isArray(data?.rows) && (
        <Table rows={data.rows as Record<string, number | string>[]} cols={[["category", "Category", (r) => String(r.category)], ["count", "Entries", (r) => String(r.count)], ["total", "Total", (r) => <b>{inr2(Number(r.total))}</b>]]} />
      )}

      {tab === "purchases" && Array.isArray(data?.rows) && (
        <Table
          rows={data.rows as Record<string, number | string>[]}
          cols={[
            ["purchase_no", "Purchase", (r) => <Link href={`/admin/purchases/${r.id}`} className="text-gold underline">{String(r.purchase_no)}</Link>],
            ["supplier_name", "Supplier", (r) => String(r.supplier_name)],
            ["status", "Status", (r) => String(r.status)],
            ["units", "Units", (r) => String(r.units)],
            ["total", "Total", (r) => inr2(Number(r.total))],
            ["created_at", "Date", (r) => fmtDate(String(r.confirmed_at ?? r.created_at))],
          ]}
        />
      )}

      {tab === "movements" && Array.isArray(data?.rows) && (
        <Table
          rows={data.rows as Record<string, number | string>[]}
          cols={[
            ["created_at", "When", (r) => fmtDate(String(r.created_at))],
            ["product_name", "Product", (r) => `${r.product_name} (${r.label})`],
            ["type", "Type", (r) => String(r.type).replace("_", " ").toLowerCase()],
            ["qty_change", "Change", (r) => <b className={Number(r.qty_change) > 0 ? "text-green-300" : "text-ember"}>{Number(r.qty_change) > 0 ? "+" : ""}{String(r.qty_change)}</b>],
            ["ref_label", "Ref", (r) => String(r.ref_label ?? "")],
            ["user_name", "By", (r) => String(r.user_name)],
          ]}
        />
      )}
    </div>
  );
}

function SummaryView({ s, fin }: { s: Summary; fin: boolean }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Online sales" value={inr2(s.onlineTotal)} hint={`${s.onlineBills} order(s)`} tone="text-blue-300" />
        <Stat label="Shop sales" value={inr2(s.offlineTotal)} hint={`${s.offlineBills} bill(s)`} tone="text-purple-300" />
        <Stat label="Billed total (incl. GST)" value={inr2(s.billedTotal)} hint={`${s.unitsSold} unit(s) net`} tone="text-gold" />
        <Stat label="Net sales (excl. GST)" value={inr2(s.netSales)} hint="after discounts & returns" />
      </div>
      <Card title="How profit is calculated">
        <dl className="space-y-1.5 text-sm">
          <Row label="Gross sales at list price" value={inr2(s.grossSales)} />
          <Row label="− Discounts" value={`− ${inr2(s.discounts)}`} />
          <Row label="− GST collected (paid to government)" value={`− ${inr2(s.taxCollected)}`} />
          <Row label="+ Delivery charges (excl. GST)" value={inr2(s.delivery)} />
          <Row label={`− Returns / cancellations (${s.returns.count})`} value={`− ${inr2(s.returns.value)}`} />
          <Row label="= Net sales" value={inr2(s.netSales)} strong />
          {fin && s.cogs !== null && (
            <>
              <Row label="− Cost of goods sold (purchase cost at time of each sale)" value={`− ${inr2(s.cogs)}`} />
              <Row label={`= Gross profit (${s.grossMarginPct}% margin)`} value={inr2(s.grossProfit ?? 0)} strong tone="text-green-300" />
              <Row label={`− Recorded operating expenses (${s.expenseCount})`} value={`− ${inr2(s.expenses ?? 0)}`} />
              <Row label="= Estimated operating profit" value={inr2(s.estimatedOperatingProfit ?? 0)} strong tone={(s.estimatedOperatingProfit ?? 0) >= 0 ? "text-green-300" : "text-ember"} />
            </>
          )}
        </dl>
        {fin && (
          <p className="mt-3 text-xs text-smoke">
            “Estimated” because only expenses entered in Expenses are subtracted. Stock purchases are not expenses — unsold stock is an asset (shown in Inventory at cost), and each item&apos;s cost counts only when it is sold.
          </p>
        )}
        {fin && s.missingCost && s.missingCost.units > 0 && (
          <Alert tone="warn" className="mt-3">{s.missingCost.units} unit(s) sold had no recorded purchase cost (counted as ₹0) — profit is overstated by up to {inr2(s.missingCost.salesValue)}.</Alert>
        )}
        {!fin && <p className="mt-3 text-xs text-smoke">Cost and profit figures are visible to the owner only.</p>}
      </Card>
    </div>
  );
}

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <div className={cn("flex justify-between gap-3", strong && "border-t border-white/10 pt-1.5 font-bold")}>
      <dt className={strong ? "" : "text-zinc-300"}>{label}</dt>
      <dd className={tone}>{value}</dd>
    </div>
  );
}

type Col = [string, string, (r: Record<string, number | string | boolean>) => React.ReactNode];

function Table({ rows, cols }: { rows: Record<string, number | string | boolean>[]; cols: Col[] }) {
  if (!rows.length) return <Empty>No data for this period.</Empty>;
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/8">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="bg-white/5 text-left text-xs text-smoke">
          <tr>{cols.map((c) => <th key={c[0]} className="p-2.5">{c[1]}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-white/5">{cols.map((c) => <td key={c[0]} className="p-2.5">{c[2](r)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Daily({ rows, fin }: { rows: { day: string; online: number; offline: number; online_bills: number; offline_bills: number; net_sales: number; cogs?: number }[]; fin: boolean }) {
  const max = Math.max(1, ...rows.map((r) => r.online + r.offline));
  const tot = rows.reduce((a, r) => ({ online: a.online + r.online, offline: a.offline + r.offline }), { online: 0, offline: 0 });
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Online" value={inr2(tot.online)} hint={`${tot.online + tot.offline ? Math.round((tot.online / (tot.online + tot.offline)) * 100) : 0}% of sales`} tone="text-blue-300" />
        <Stat label="Shop" value={inr2(tot.offline)} hint={`${tot.online + tot.offline ? Math.round((tot.offline / (tot.online + tot.offline)) * 100) : 0}% of sales`} tone="text-purple-300" />
      </div>
      <Card title="Day by day (billed totals)">
        <div className="mb-2 flex gap-4 text-xs"><span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-400" /> Online</span><span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-purple-400" /> Shop</span></div>
        <ul className="space-y-1">
          {rows.map((r) => (
            <li key={r.day} className="grid grid-cols-[4.5rem_1fr_5.5rem] items-center gap-2 text-xs">
              <span className="text-smoke">{fmtDay(r.day).slice(0, 6)}</span>
              <span className="flex h-4 overflow-hidden rounded bg-white/5" title={`Online ${inr2(r.online)} · Shop ${inr2(r.offline)}`}>
                <span className="bg-blue-400" style={{ width: `${(r.online / max) * 100}%` }} />
                <span className="bg-purple-400" style={{ width: `${(r.offline / max) * 100}%` }} />
              </span>
              <span className="text-right">{inr2(r.online + r.offline)}{fin && r.cogs !== undefined && r.net_sales > 0 ? <span className="block text-[0.6rem] text-green-300">GP {inr2(r.net_sales - r.cogs)}</span> : null}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
