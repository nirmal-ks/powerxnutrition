"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { formatDate, inr, cn } from "@/lib/format";
import { listLocalOrders, loadLocalOrder, saveLocalOrder } from "@/lib/order-storage";
import { whatsappLink } from "@/lib/whatsapp";
import { siteConfig } from "@/config/site";
import type { Order, OrderStatus, PublicOrder } from "@/types";
import { ArrowRight, CheckIcon, ClockIcon, SearchIcon, TruckIcon, WhatsAppIcon } from "../ui/Icons";

const STEPS: { status: OrderStatus; label: string; text: string }[] = [
  { status: "new", label: "Order placed", text: "We've received your order." },
  { status: "confirmed", label: "Confirmed", text: "Stock checked & packed." },
  { status: "shipped", label: "Shipped", text: "On the way to you." },
  { status: "delivered", label: "Delivered", text: "Enjoy your gains! 💪" },
];

const PAYMENT_TEXT: Record<string, { label: string; tone: string }> = {
  unpaid: { label: "Payment pending", tone: "text-amber-400" },
  verifying: { label: "Verifying payment", tone: "text-gold" },
  paid: { label: "Paid", tone: "text-green-400" },
  refunded: { label: "Refunded", tone: "text-zinc-300" },
};

export function TrackOrder() {
  const params = useSearchParams();
  const [id, setId] = useState(params.get("id") ?? "");
  const [phone, setPhone] = useState("");
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [billPdfUrl, setBillPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mine, setMine] = useState<Order[]>([]);

  const track = async (orderId: string, mobile: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/orders/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: orderId.trim().toUpperCase(), phone: mobile }),
      });
      const data = (await res.json()) as { order?: PublicOrder; billPdfUrl?: string | null; error?: string };
      if (!res.ok || !data.order) throw new Error(data.error || "Could not find the order");
      setOrder(data.order);
      setBillPdfUrl(data.billPdfUrl ?? null);
      const local = loadLocalOrder(data.order.id);
      if (local) saveLocalOrder({ ...local, ...data.order });
    } catch (e) {
      setOrder(null);
      setError(e instanceof Error ? e.message : "Could not find the order");
    } finally {
      setLoading(false);
    }
  };

  // Orders placed on this device: fill in the phone automatically, and track straight away from a ?id= link.
  useEffect(() => {
    const list = listLocalOrders();
    setMine(list);
    const fromUrl = params.get("id")?.toUpperCase();
    const match = fromUrl && list.find((o) => o.id === fromUrl);
    if (match) {
      setPhone(match.customer.phone);
      track(match.id, match.customer.phone);
    }
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    track(id, phone);
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[24rem_1fr]">
      <div className="space-y-6">
        <form onSubmit={submit} className="rounded-3xl border border-white/8 bg-gradient-to-b from-steel to-coal p-6">
          <h2 className="font-display text-2xl">Find your order</h2>
          <p className="mt-1 text-sm text-smoke">Enter the Order ID (e.g. PX260928-7KQ2) and the mobile number you ordered with.</p>
          <label className="mt-5 block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-400">Order ID</span>
            <input value={id} onChange={(e) => setId(e.target.value)} placeholder="PX______-____" className="input uppercase" required autoCapitalize="characters" />
          </label>
          <label className="mt-4 block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-400">Mobile number</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile" inputMode="tel" autoComplete="tel" className="input" required />
          </label>
          {error && <p className="mt-3 rounded-xl border border-ember/40 bg-ember/10 p-3 text-sm text-ember" role="alert">{error}</p>}
          <button disabled={loading} className="btn btn-red shine mt-5 w-full">
            {loading ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <SearchIcon size={18} />} Track order
          </button>
        </form>

        {mine.length > 0 && (
          <div className="rounded-3xl border border-white/8 bg-white/[0.02] p-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-smoke">Orders from this device</p>
            <ul className="mt-3 space-y-2">
              {mine.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setId(o.id);
                      setPhone(o.customer.phone);
                      track(o.id, o.customer.phone);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition",
                      order?.id === o.id ? "border-gold/50 bg-gold/10" : "border-white/8 hover:border-white/20",
                    )}
                  >
                    <span>
                      <span className="block font-bold">{o.id}</span>
                      <span className="block text-xs text-smoke">{formatDate(o.createdAt)} · {o.items.reduce((s, i) => s + i.qty, 0)} item(s)</span>
                    </span>
                    <span className="font-bold text-gold">{inr(o.total)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div>{order ? <OrderStatusCard order={order} billPdfUrl={billPdfUrl} /> : <EmptyState />}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full min-h-72 flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 p-10 text-center">
      <TruckIcon size={44} className="text-smoke" />
      <p className="font-display mt-4 text-3xl">Where&apos;s my order?</p>
      <p className="mt-2 max-w-sm text-sm text-smoke">
        Your Order ID is on the confirmation page and in the WhatsApp message you sent us. Lost it? Just message us — we&apos;ll find it with your mobile number.
      </p>
      <a href={whatsappLink(`Hi ${siteConfig.name}, I need the status of my order.`)} target="_blank" rel="noopener" className="btn btn-whatsapp mt-6">
        <WhatsAppIcon size={18} /> Ask on WhatsApp
      </a>
    </div>
  );
}

function OrderStatusCard({ order, billPdfUrl }: { order: PublicOrder; billPdfUrl: string | null }) {
  const cancelled = order.status === "cancelled";
  const reached = STEPS.findIndex((s) => s.status === order.status);
  const pay = PAYMENT_TEXT[order.paymentStatus];
  const upiPending = order.paymentMethod === "upi" && (order.paymentStatus === "unpaid" || order.paymentStatus === "verifying") && !cancelled;

  return (
    <div className="animate-fade-up space-y-6 rounded-3xl border border-white/10 bg-gradient-to-b from-steel to-coal p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-smoke">Order</p>
          <p className="font-display text-3xl tracking-wider">{order.id}</p>
          <p className="text-xs text-smoke">Placed {formatDate(order.createdAt)}</p>
          {billPdfUrl && (
            <a href={billPdfUrl} target="_blank" rel="noopener" className="btn btn-gold mt-3 px-4! py-2! text-xs!">
              ⬇ Download bill (PDF){order.billNo ? ` · ${order.billNo}` : ""}
            </a>
          )}
        </div>
        <div className="text-right">
          <p className="font-display text-3xl text-gold">{inr(order.total)}</p>
          <p className={cn("text-sm font-bold", pay?.tone)}>
            {order.paymentMethod === "cod" ? "Cash on Delivery" : order.paymentMethod === "upi" ? "UPI" : "WhatsApp"} · {pay?.label}
          </p>
        </div>
      </div>

      {upiPending && (
        <div className="rounded-2xl border border-gold/40 bg-gold/10 p-4 text-sm text-gold">
          <p className="flex items-center gap-2 font-bold">
            <ClockIcon size={16} /> {order.paymentStatus === "verifying" ? "We're verifying your UPI payment." : "Your UPI payment is pending."}
          </p>
          <p className="mt-1 text-zinc-300">
            {order.paymentStatus === "verifying"
              ? "Your order will be confirmed as soon as the payment is matched."
              : "Complete the payment to confirm your order."}
          </p>
          {order.paymentStatus === "unpaid" &&
            (loadLocalOrder(order.id) ? (
              <Link href={`/order-success?id=${encodeURIComponent(order.id)}`} className="btn btn-gold mt-3 py-2.5! text-xs!">
                Pay now <ArrowRight size={14} />
              </Link>
            ) : (
              <p className="mt-2 text-zinc-300">
                Pay {inr(order.total)} to UPI ID <b className="select-all text-white">{siteConfig.upi.id}</b> and send the screenshot on WhatsApp with your Order ID.
              </p>
            ))}
        </div>
      )}

      {cancelled ? (
        <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
          This order was cancelled. If you have any questions, message us on WhatsApp with your Order ID.
        </p>
      ) : (
        <ol className="relative grid gap-5 sm:grid-cols-4 sm:gap-2">
          {STEPS.map((s, i) => {
            const done = i <= reached;
            const current = i === reached;
            return (
              <li key={s.status} className="relative flex gap-3 sm:flex-col sm:items-center sm:text-center">
                {i > 0 && (
                  <span
                    className={cn("absolute -top-5 left-[15px] h-5 w-0.5 sm:left-auto sm:right-1/2 sm:top-[15px] sm:h-0.5 sm:w-full", done ? "bg-green-400" : "bg-white/10")}
                    aria-hidden
                  />
                )}
                <span
                  className={cn(
                    "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2",
                    done ? "border-green-400 bg-green-500 text-snow" : "border-white/15 bg-coal text-smoke",
                    current && "shadow-[0_0_0_5px_rgba(74,222,128,0.2)]",
                  )}
                >
                  {done ? <CheckIcon size={16} strokeWidth={3} /> : <span className="text-xs font-bold">{i + 1}</span>}
                </span>
                <span>
                  <span className={cn("block text-sm font-bold", done ? "text-white" : "text-smoke")}>{s.label}</span>
                  <span className="block text-xs text-smoke">{s.text}</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {order.tracking && (
        <div className="flex items-start gap-3 rounded-2xl border border-green-500/30 bg-green-500/10 p-4 text-sm">
          <TruckIcon size={20} className="mt-0.5 shrink-0 text-green-400" />
          <div>
            <p className="font-bold text-green-300">Delivery update</p>
            <p className="mt-0.5 text-zinc-200">{order.tracking}</p>
          </div>
        </div>
      )}

      <div className="grid gap-5 border-t border-white/10 pt-5 sm:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-smoke">Items</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {order.items.map((i) => (
              <li key={i.slug + i.variantId} className="flex justify-between gap-3">
                <span className="text-zinc-300">
                  {i.name} <span className="text-smoke">({i.variantLabel}) × {i.qty}</span>
                </span>
                <span className="shrink-0 font-semibold">{inr(i.price * i.qty)}</span>
              </li>
            ))}
            {!!order.discount && (
              <li className="flex justify-between gap-3 text-green-400">
                <span>Coupon {order.couponCode}</span>
                <span>− {inr(order.discount)}</span>
              </li>
            )}
          </ul>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-smoke">Delivering to</p>
          <p className="mt-2 text-sm font-semibold">{order.customer.name}</p>
          <p className="text-sm text-zinc-300">
            {order.customer.address}, {order.customer.city}, {order.customer.district} – {order.customer.pincode}
          </p>
        </div>
      </div>

      <a
        href={whatsappLink(`Hi ${siteConfig.name}, I have a question about my order ${order.id}.`)}
        target="_blank"
        rel="noopener"
        className="btn btn-ghost w-full"
      >
        <WhatsAppIcon size={18} className="text-[#25d366]" /> Question about this order? Chat with us
      </a>
    </div>
  );
}
