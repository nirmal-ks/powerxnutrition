"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { siteConfig } from "@/config/site";
import { cn, formatDate, inr } from "@/lib/format";
import { mapsPinUrl } from "@/lib/geo";
import { whatsappLink } from "@/lib/whatsapp";
import type { Order, OrderStatus, PaymentStatus } from "@/types";
import { PhoneIcon, SearchIcon, WhatsAppIcon } from "../ui/Icons";
import { PaymentBadge, StatusBadge } from "./badges";
import { OrderWhatsAppTools } from "./OrderWhatsAppTools";

const STATUSES: OrderStatus[] = ["new", "confirmed", "shipped", "delivered", "cancelled"];
const PAYMENTS: PaymentStatus[] = ["unpaid", "verifying", "paid", "refunded"];

const customerMessage = (o: Order) => {
  const lines: Record<OrderStatus, string> = {
    new: `we've received your order *${o.id}* for ${inr(o.total)}.`,
    confirmed: `your order *${o.id}* is confirmed ✅ and will be packed shortly.`,
    shipped: `your order *${o.id}* has been shipped 🚚.${o.tracking ? ` ${o.tracking}.` : ""} It will reach you soon.`,
    delivered: `your order *${o.id}* has been delivered. Thank you for shopping with us! 💪`,
    cancelled: `your order *${o.id}* has been cancelled. Please reply if you have any questions.`,
  };
  const track = `${siteConfig.url}/track-order?id=${o.id}`;
  return `Hi ${o.customer.name.split(" ")[0]}, ${lines[o.status]}\nTrack it here: ${track}\n— ${siteConfig.name}`;
};

export function OrdersManager({ orders: initial }: { orders: Order[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const [orders, setOrders] = useState(initial);
  const [status, setStatus] = useState<string>(params.get("status") ?? "all");
  const [payment, setPayment] = useState<string>(params.get("payment") ?? "all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(params.get("open"));
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return orders.filter(
      (o) =>
        (status === "all" || o.status === status) &&
        (payment === "all" || o.paymentStatus === payment) &&
        (!s || `${o.id} ${o.customer.name} ${o.customer.phone} ${o.customer.city} ${o.utr ?? ""}`.toLowerCase().includes(s)),
    );
  }, [orders, status, payment, q]);

  const update = async (id: string, patch: Partial<Order>) => {
    setSaving(id);
    setError("");
    const res = await fetch(`/api/admin/orders/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    setSaving(null);
    if (!res.ok) return setError(data.error || "Update failed");
    setOrders((prev) => prev.map((o) => (o.id === id ? data.order : o)));
    router.refresh();
  };

  const count = (s: string) => (s === "all" ? orders.length : orders.filter((o) => o.status === s).length);

  return (
    <div>
      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
        {["all", ...STATUSES].map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={cn(
              "shrink-0 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wider",
              status === s ? "border-transparent bg-blood text-white" : "border-white/10 text-zinc-400 hover:text-white",
            )}
          >
            {s} ({count(s)})
          </button>
        ))}
      </div>
      <div className="mb-6 flex flex-wrap gap-3">
        <label className="relative min-w-0 flex-1 basis-64">
          <SearchIcon size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-smoke" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search order ID, name, phone, UTR…" className="input pl-10" />
        </label>
        <select value={payment} onChange={(e) => setPayment(e.target.value)} className="input w-auto!">
          <option value="all" className="bg-coal">All payments</option>
          {PAYMENTS.map((p) => (
            <option key={p} value={p} className="bg-coal">{p === "verifying" ? "UTR to verify" : p}</option>
          ))}
        </select>
      </div>
      {error && <p className="mb-4 rounded-xl border border-ember/40 bg-ember/10 p-3 text-sm text-ember">{error}</p>}

      {!list.length && <p className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-smoke">No orders match.</p>}

      <ul className="space-y-3">
        {list.map((o) => {
          const expanded = open === o.id;
          const c = o.customer;
          return (
            <li key={o.id} className={cn("rounded-2xl border bg-coal transition", expanded ? "border-gold/40" : "border-white/8")}>
              <button onClick={() => setOpen(expanded ? null : o.id)} className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left">
                <span>
                  <span className="block font-bold">
                    {o.id} <span className="font-normal text-zinc-400">· {c.name}</span>
                  </span>
                  <span className="block text-xs text-smoke">
                    {formatDate(o.createdAt)} · {o.items.reduce((s, i) => s + i.qty, 0)} item(s) · {c.city} · {o.paymentMethod.toUpperCase()}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <PaymentBadge status={o.paymentStatus} />
                  <StatusBadge status={o.status} />
                  <b className="w-20 text-right text-gold">{inr(o.total)}</b>
                </span>
              </button>

              {expanded && (
                <div className="grid gap-6 border-t border-white/8 p-4 md:grid-cols-2">
                  <div className="space-y-4 text-sm">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-smoke">Items</p>
                      <ul className="mt-2 space-y-1">
                        {o.items.map((i) => (
                          <li key={i.slug + i.variantId} className="flex justify-between gap-3">
                            <span>{i.name} <span className="text-smoke">({i.variantLabel}) × {i.qty}</span></span>
                            <span>{inr(i.price * i.qty)}</span>
                          </li>
                        ))}
                        {!!o.discount && (
                          <li className="flex justify-between border-t border-white/8 pt-1 text-green-400"><span>Coupon {o.couponCode}</span><span>− {inr(o.discount)}</span></li>
                        )}
                        <li className="flex justify-between border-t border-white/8 pt-1 text-smoke"><span>Delivery</span><span>{o.delivery ? inr(o.delivery) : "FREE"}</span></li>
                        <li className="flex justify-between font-bold"><span>Total</span><span className="text-gold">{inr(o.total)}</span></li>
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-smoke">Customer</p>
                      <p className="mt-2 font-semibold">{c.name} · {c.phone}</p>
                      {c.email && <p className="text-zinc-400">{c.email}</p>}
                      <p className="text-zinc-300">{c.address}, {c.city}, {c.district}, {c.state} – {c.pincode}</p>
                      {o.location && (
                        <a href={mapsPinUrl(o.location)} target="_blank" rel="noopener" className="mt-1 inline-block text-xs text-gold underline">
                          Customer location · ~{o.location.distanceKm} km from shop (open map)
                        </a>
                      )}
                      {o.notes && <p className="mt-2 rounded-lg bg-white/5 p-2 text-zinc-300">Note: {o.notes}</p>}
                    </div>
                    {o.utr && (
                      <p className="rounded-lg border border-gold/30 bg-gold/10 p-3">
                        UPI reference (UTR): <b className="select-all text-gold">{o.utr}</b>
                        <span className="block text-xs text-zinc-400">Check this in your UPI app / bank statement for {inr(o.total)}, then mark payment as “paid”.</span>
                      </p>
                    )}
                  </div>

                  <div className="space-y-4">
                    {o.paymentMethod === "upi" && o.paymentStatus !== "paid" && o.status !== "cancelled" && (
                      <p className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-zinc-300">
                        UPI order — mark payment <b>paid</b> after checking your UPI app. Only then can it be confirmed/shipped, and the customer&apos;s page shows “Payment successful”.
                      </p>
                    )}
                    <label className="block">
                      <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-smoke">Order status</span>
                      <select
                        value={o.status}
                        disabled={saving === o.id || o.status === "cancelled"}
                        onChange={(e) => {
                          const next = e.target.value as OrderStatus;
                          if (next === "cancelled") {
                            const reason = window.prompt("Cancel this order? Stock goes back on the shelf and this can't be undone.\n\nReason for cancelling:");
                            if (!reason) return;
                            update(o.id, { status: next, cancelReason: reason } as Partial<Order>);
                            return;
                          }
                          update(o.id, { status: next });
                        }}
                        className="input"
                      >
                        {STATUSES.map((s) => <option key={s} value={s} className="bg-coal">{s}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-smoke">Payment status</span>
                      <select
                        value={o.paymentStatus}
                        disabled={saving === o.id || (o.paymentMethod === "razorpay" && o.paymentStatus !== "paid")}
                        title={o.paymentMethod === "razorpay" ? "Gateway payments are marked paid automatically after Razorpay verifies them" : undefined}
                        onChange={(e) => update(o.id, { paymentStatus: e.target.value as PaymentStatus })}
                        className="input"
                      >
                        {PAYMENTS.map((p) => <option key={p} value={p} className="bg-coal">{p}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-smoke">Courier / tracking (customer sees this)</span>
                      <input
                        defaultValue={o.tracking ?? ""}
                        onBlur={(e) => e.target.value.trim() !== (o.tracking ?? "") && update(o.id, { tracking: e.target.value })}
                        placeholder="e.g. DTDC · AWB 1234567890, or “Out for delivery today”"
                        className="input"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-smoke">Internal note (only you see this)</span>
                      <textarea
                        defaultValue={o.adminNotes ?? ""}
                        onBlur={(e) => e.target.value !== (o.adminNotes ?? "") && update(o.id, { adminNotes: e.target.value })}
                        rows={2}
                        placeholder="Anything for your own reference (saved when you click away)"
                        className="input resize-none"
                      />
                    </label>
                    {o.billNo && (
                      <p className="text-xs text-smoke">
                        Recorded as bill <a href={`/admin/sales/${encodeURIComponent(o.billNo)}`} className="font-bold text-gold underline">{o.billNo}</a> (stock deducted)
                      </p>
                    )}
                    <OrderWhatsAppTools order={o} />
                    {o.paymentMethod === "razorpay" && (
                      <p className="text-xs text-smoke">Razorpay payment: {o.paymentStatus === "paid" ? "verified by the gateway ✔" : "not verified yet — never mark it paid by hand"}</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <a href={whatsappLink(customerMessage(o), `91${c.phone}`)} target="_blank" rel="noopener" className="btn btn-whatsapp py-2.5! text-xs!">
                        <WhatsAppIcon size={16} /> Message customer
                      </a>
                      <a href={`tel:+91${c.phone}`} className="btn btn-ghost py-2.5! text-xs!">
                        <PhoneIcon size={16} /> Call
                      </a>
                    </div>
                    {saving === o.id && <p className="text-xs text-smoke">Saving…</p>}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
