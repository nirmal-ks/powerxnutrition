"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { inr2 } from "@/lib/money";
import type { SaleListRow } from "@/lib/server/sales";
import { SearchIcon } from "../../ui/Icons";
import { Alert, Badge, Empty, fmtDate, istDaysAgo, istToday, useApi } from "../ui";

const STATUS_TONE: Record<string, "green" | "gold" | "red" | "zinc"> = { completed: "green", partially_returned: "gold", returned: "red", cancelled: "zinc" };

export function SalesHistory({ canSeeAll }: { canSeeAll: boolean }) {
  const [f, setF] = useState({ q: "", product: "", from: istDaysAgo(6), to: istToday(), channel: "", method: "", status: "" });
  const url = useMemo(() => {
    const p = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]);
    p.set("limit", "200");
    return `/api/admin/sales?${p}`;
  }, [f]);
  const { data, error, loading } = useApi<{ sales: SaleListRow[] }>(url);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const total = data?.sales.filter((s) => s.status !== "cancelled").reduce((s, r) => s + r.total, 0) ?? 0;

  return (
    <div>
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="relative sm:col-span-2">
          <SearchIcon size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-smoke" />
          <input value={f.q} onChange={set("q")} placeholder="Bill no, order id, customer name or phone" className="input pl-10" />
        </label>
        <input value={f.product} onChange={set("product")} placeholder="Product / SKU" className="input" />
        <div className="flex gap-2">
          <input type="date" value={f.from} onChange={set("from")} className="input py-2!" aria-label="From" />
          <input type="date" value={f.to} onChange={set("to")} className="input py-2!" aria-label="To" />
        </div>
        {canSeeAll && (
          <select value={f.channel} onChange={set("channel")} className="input">
            <option value="" className="bg-coal">Online + shop</option>
            <option value="OFFLINE" className="bg-coal">Shop bills (POS)</option>
            <option value="ONLINE" className="bg-coal">Online orders</option>
          </select>
        )}
        <select value={f.method} onChange={set("method")} className="input">
          <option value="" className="bg-coal">Any payment</option>
          {["cash", "upi", "card", "other", "cod", "razorpay"].map((m) => <option key={m} value={m} className="bg-coal">{m.toUpperCase()}</option>)}
        </select>
        <select value={f.status} onChange={set("status")} className="input">
          <option value="" className="bg-coal">Any status</option>
          <option value="completed" className="bg-coal">Completed</option>
          <option value="partially_returned" className="bg-coal">Partly returned</option>
          <option value="returned" className="bg-coal">Returned</option>
          <option value="cancelled" className="bg-coal">Cancelled</option>
        </select>
      </div>
      {error && <Alert>{error}</Alert>}
      <p className="mb-2 text-xs text-smoke">
        {loading ? "Loading…" : `${data?.sales.length ?? 0} bill(s) · ${inr2(total)} (excluding cancelled)`}
      </p>
      {!loading && !data?.sales.length && <Empty>No bills match these filters.</Empty>}
      <ul className="space-y-2">
        {data?.sales.map((s) => (
          <li key={s.id}>
            <Link href={`/admin/sales/${s.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/8 bg-coal p-3 transition hover:border-gold/40">
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2 font-semibold">
                  {s.bill_no}
                  <Badge tone={s.channel === "ONLINE" ? "blue" : "purple"}>{s.channel === "ONLINE" ? "Online" : "Shop"}</Badge>
                  {s.document_type === "tax_invoice" && <Badge tone="gold">GST</Badge>}
                </span>
                <span className="block text-xs text-smoke">
                  {fmtDate(s.created_at)} · {s.items} item(s) · {(s.methods ?? "—").toUpperCase()}
                  {s.customer_name || s.customer_phone ? ` · ${[s.customer_name, s.customer_phone].filter(Boolean).join(" ")}` : ""}
                  {s.order_id ? ` · ${s.order_id}` : ""}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <Badge tone={STATUS_TONE[s.status] ?? "zinc"}>{s.status.replace("_", " ")}</Badge>
                <b className="w-24 text-right text-gold">{inr2(s.total)}</b>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
