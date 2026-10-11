"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { siteConfig } from "@/config/site";
import { formatDate, inr } from "@/lib/format";
import { loadLocalOrder, saveLocalOrder } from "@/lib/order-storage";
import { orderMessage, whatsappLink } from "@/lib/whatsapp";
import type { Order } from "@/types";
import { ArrowRight, CheckIcon, ClockIcon, CopyIcon, WhatsAppIcon } from "../ui/Icons";
import { UpiQr } from "./UpiQr";

const PAYMENT_LABEL = { cod: "Cash on Delivery", upi: "UPI", whatsapp: "Confirm on WhatsApp", razorpay: "Online payment" } as const;

export function OrderSuccess() {
  const id = useSearchParams().get("id") ?? "";
  const [order, setOrder] = useState<Order | null | undefined>(undefined);
  const [copied, setCopied] = useState(false);

  useEffect(() => setOrder(id ? loadLocalOrder(id) : null), [id]);

  // A UPI order is only "successful" once the shop verifies the money arrived — keep checking until then.
  const awaitingPayment =
    (order?.paymentMethod === "upi" || order?.paymentMethod === "razorpay") &&
    order.status !== "cancelled" &&
    (order.paymentStatus === "unpaid" || order.paymentStatus === "verifying");
  const prepaid = order?.paymentMethod === "upi" || order?.paymentMethod === "razorpay";
  const phone = order?.customer.phone;
  useEffect(() => {
    if (!awaitingPayment || !phone) return;
    let stop = false;
    const poll = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(id)}/payment?phone=${phone}`, { cache: "no-store" });
        if (!res.ok || stop) return;
        const { order: fresh } = (await res.json()) as { order: Order };
        setOrder(fresh);
        saveLocalOrder(fresh);
      } catch {}
    };
    poll();
    const t = setInterval(poll, 10000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [awaitingPayment, phone, id]);

  if (order === undefined) return <div className="mx-auto h-96 max-w-3xl animate-pulse rounded-3xl bg-white/5" />;

  if (!order) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="font-display text-4xl">Order not found on this device</h1>
        <p className="mt-3 text-smoke">
          If you placed an order, keep your Order ID handy and message us on WhatsApp — we&apos;ll help you right away.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href={`/track-order?id=${encodeURIComponent(id)}`} className="btn btn-gold">
            Track with Order ID <ArrowRight size={16} />
          </Link>
          <a href={whatsappLink(`Hi ${siteConfig.name}, I need help with my order ${id}`)} target="_blank" rel="noopener" className="btn btn-whatsapp">
            <WhatsAppIcon size={18} /> Contact on WhatsApp
          </a>
        </div>
      </div>
    );
  }

  const waLink = whatsappLink(orderMessage(order));
  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(order.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const firstName = order.customer.name.split(" ")[0];

  return (
    <div className="mx-auto max-w-4xl">
      {awaitingPayment ? (
        <div className="flex flex-col items-center text-center">
          <div className="animate-fade-up flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 shadow-[0_0_60px_rgba(245,183,0,0.4)]">
            <ClockIcon size={46} className="text-snow" />
          </div>
          <h1 className="font-display animate-fade-up mt-6 text-5xl [animation-delay:100ms] sm:text-6xl">
            {order.paymentStatus === "verifying" ? (
              <>Verifying <span className="text-gold-gradient">payment</span></>
            ) : (
              <>Complete your <span className="text-gold-gradient">payment</span></>
            )}
          </h1>
          <p className="animate-fade-up mt-3 max-w-lg text-zinc-300 [animation-delay:180ms]">
            {order.paymentStatus === "verifying"
              ? `Thanks, ${firstName}! We're checking your UPI payment. This page will turn green as soon as it's confirmed.`
              : `${firstName}, your order is reserved but not confirmed yet. Pay ${inr(order.total)} ${order.paymentMethod === "razorpay" ? "online below" : "by UPI below and enter the UTR number"} to complete it.`}
          </p>
          <button onClick={copyId} className="animate-fade-up glass mt-5 inline-flex items-center gap-3 rounded-2xl px-5 py-3 [animation-delay:260ms]">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-smoke">Order ID</span>
            <span className="font-display text-2xl tracking-wider text-white">{order.id}</span>
            {copied ? <CheckIcon size={18} className="text-green-400" /> : <CopyIcon size={18} className="text-smoke" />}
          </button>
          <p className="mt-2 text-xs text-smoke">{formatDate(order.createdAt)}</p>
        </div>
      ) : (
      <div className="relative flex flex-col items-center text-center">
        <div className="pointer-events-none absolute inset-x-0 -top-6 h-40 overflow-hidden" aria-hidden>
          {Array.from({ length: 24 }, (_, i) => (
            <span
              key={i}
              className="absolute top-0 h-3 w-1.5 rounded-sm"
              style={{
                left: `${(i * 97) % 100}%`,
                background: ["#e10600", "#f5b700", "#ffffff", "#ff3131"][i % 4],
                animation: `confetti ${1.6 + (i % 5) * 0.25}s ${(i % 6) * 0.08}s cubic-bezier(.2,.6,.4,1) both`,
                transform: `rotate(${i * 37}deg)`,
              }}
            />
          ))}
        </div>
        <div className="animate-fade-up relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-green-600 shadow-[0_0_60px_rgba(74,222,128,0.5)]">
          <span className="absolute inset-0 animate-ping rounded-full bg-green-400/30" />
          <CheckIcon size={48} className="relative text-snow" strokeWidth={3} />
        </div>
        <h1 className="font-display animate-fade-up mt-6 text-5xl [animation-delay:100ms] sm:text-6xl">
          {prepaid && order.paymentStatus === "paid" ? (
            <>Payment <span className="text-gold-gradient">successful!</span></>
          ) : (
            <>Order <span className="text-gold-gradient">placed!</span></>
          )}
        </h1>
        <p className="animate-fade-up mt-3 text-zinc-300 [animation-delay:180ms]">
          {prepaid && order.paymentStatus === "paid"
            ? `Thank you, ${firstName}! 💪 We've received ${inr(order.total)} and your order is confirmed.`
            : `Thank you, ${firstName}! 💪 Your order has been received.`}
        </p>
        <button onClick={copyId} className="animate-fade-up glass mt-5 inline-flex items-center gap-3 rounded-2xl px-5 py-3 [animation-delay:260ms]">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-smoke">Order ID</span>
          <span className="font-display text-2xl tracking-wider text-white">{order.id}</span>
          {copied ? <CheckIcon size={18} className="text-green-400" /> : <CopyIcon size={18} className="text-smoke" />}
        </button>
        <p className="mt-2 text-xs text-smoke">{formatDate(order.createdAt)}</p>
      </div>
      )}

      {/* WhatsApp CTA */}
      <div className="animate-fade-up mt-10 rounded-3xl border border-[#25d366]/30 bg-[#25d366]/[0.06] p-5 text-center [animation-delay:320ms] sm:p-7">
        <p className="font-semibold">
          {order.paymentMethod === "whatsapp"
            ? "Final step: send your order to us on WhatsApp to confirm payment & delivery."
            : awaitingPayment
              ? "Paid already? Send your order with the payment screenshot on WhatsApp for faster verification."
              : "Send your order details to us on WhatsApp for faster confirmation."}
        </p>
        <a href={waLink} target="_blank" rel="noopener" className="btn btn-whatsapp shine mt-4 w-full py-4! text-base! sm:w-auto sm:px-10!">
          <WhatsAppIcon size={22} /> Send order on WhatsApp
        </a>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {/* Payment */}
        <section className="rounded-3xl border border-white/10 bg-gradient-to-b from-steel to-coal p-6">
          <h2 className="font-display text-2xl">Payment · {PAYMENT_LABEL[order.paymentMethod]}</h2>
          {prepaid && order.paymentStatus === "paid" ? (
            <p className="mt-5 flex items-start gap-2 rounded-2xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-300">
              <CheckIcon size={18} className="mt-0.5 shrink-0" />
              <span>
                Payment of <b>{inr(order.total)}</b> received{order.utr ? <> (UTR <b>{order.utr}</b>)</> : null}. Your order is confirmed.
              </span>
            </p>
          ) : order.paymentMethod === "razorpay" ? (
            <GatewayPay order={order} onPaid={(o) => { setOrder(o); saveLocalOrder(o); }} />
          ) : order.paymentMethod === "upi" ? (
            <div className="mt-5">
              <UpiQr amount={order.total} orderId={order.id} />
              <UtrForm order={order} onUpdated={(o) => { setOrder(o); saveLocalOrder(o); }} />
            </div>
          ) : order.paymentMethod === "cod" ? (
            <div className="mt-4 space-y-3 text-sm text-zinc-300">
              <p>
                Please keep <b className="text-gold">{inr(order.total)}</b> ready. You can pay in cash or by UPI to the delivery person.
              </p>
              <p>We&apos;ll call you on <b className="text-white">{order.customer.phone}</b> to confirm before dispatch.</p>
            </div>
          ) : (
            <div className="mt-4 space-y-3 text-sm text-zinc-300">
              <p>Tap “Send order on WhatsApp” above. We&apos;ll confirm stock, delivery and payment options with you in chat.</p>
              <p>Prefer to pay now? You can also pay by UPI:</p>
              <UpiQr amount={order.total} orderId={order.id} />
            </div>
          )}
        </section>

        {/* Summary */}
        <section className="rounded-3xl border border-white/10 bg-gradient-to-b from-steel to-coal p-6">
          <h2 className="font-display text-2xl">Order summary</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {order.items.map((i) => (
              <li key={i.slug + i.variantId} className="flex justify-between gap-3">
                <span className="text-zinc-300">
                  {i.name} <span className="text-smoke">({i.variantLabel}) × {i.qty}</span>
                </span>
                <span className="shrink-0 font-semibold">{inr(i.price * i.qty)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1.5 border-t border-white/10 pt-4 text-sm">
            <div className="flex justify-between text-zinc-300"><dt>Subtotal</dt><dd>{inr(order.subtotal)}</dd></div>
            {!!order.discount && (
              <div className="flex justify-between text-green-400"><dt>Coupon ({order.couponCode})</dt><dd>− {inr(order.discount)}</dd></div>
            )}
            <div className="flex justify-between text-zinc-300"><dt>Delivery</dt><dd>{order.delivery ? inr(order.delivery) : "FREE"}</dd></div>
            <div className="flex justify-between pt-1 text-lg font-extrabold"><dt>Total</dt><dd className="text-gold">{inr(order.total)}</dd></div>
          </dl>
          <div className="mt-5 rounded-2xl bg-white/[0.03] p-4 text-sm">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-smoke">Delivering to</p>
            <p className="mt-2 font-semibold">{order.customer.name} · {order.customer.phone}</p>
            <p className="text-zinc-300">
              {order.customer.address}, {order.customer.city}, {order.customer.district}, {order.customer.state} – {order.customer.pincode}
            </p>
          </div>
        </section>
      </div>

      <div className="mt-10 flex flex-wrap justify-center gap-3 text-center">
        <Link href={`/track-order?id=${encodeURIComponent(order.id)}`} className="btn btn-gold">
          Track this order <ArrowRight size={16} />
        </Link>
        <Link href="/shop" className="btn btn-ghost">
          Continue shopping <ArrowRight size={16} />
        </Link>
      </div>
      <p className="mt-3 text-center text-xs text-smoke">Bookmark the Track Order page — check your order status any time with your Order ID and mobile number.</p>
      <style>{`@keyframes confetti{0%{transform:translateY(-20px) rotate(0);opacity:1}100%{transform:translateY(160px) rotate(540deg);opacity:0}}`}</style>
    </div>
  );
}

type RazorpayCtor = new (opts: Record<string, unknown>) => { open: () => void; on: (ev: string, fn: (r: { error?: { description?: string } }) => void) => void };

/** Razorpay checkout. "Paid" only appears after OUR server verifies the payment signature. */
function GatewayPay({ order, onPaid }: { order: Order; onPaid: (o: Order) => void }) {
  const [state, setState] = useState<"idle" | "loading" | "verifying" | "error">("idle");
  const [error, setError] = useState("");

  const loadScript = () =>
    new Promise<void>((resolve, reject) => {
      if ((window as unknown as { Razorpay?: RazorpayCtor }).Razorpay) return resolve();
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Couldn't load the payment window. Check your internet and try again."));
      document.body.appendChild(s);
    });

  const pay = async () => {
    setState("loading");
    setError("");
    try {
      const res = await fetch("/api/payments/razorpay/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, phone: order.customer.phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't start the payment");
      await loadScript();
      const Razorpay = (window as unknown as { Razorpay: RazorpayCtor }).Razorpay;
      const rzp = new Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: "INR",
        order_id: data.gatewayOrderId,
        name: siteConfig.name,
        description: `Order ${order.id}`,
        prefill: { name: order.customer.name, contact: order.customer.phone, email: order.customer.email || undefined },
        theme: { color: "#e10600" },
        handler: async (r: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          setState("verifying");
          const v = await fetch("/api/payments/razorpay/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...r, orderId: order.id, phone: order.customer.phone }),
          });
          const vd = await v.json();
          if (!v.ok) {
            setError(vd.error || "We couldn't verify the payment yet. If money was deducted, it will be confirmed automatically — or contact us on WhatsApp.");
            setState("error");
            return;
          }
          onPaid(vd.order);
        },
        modal: { ondismiss: () => setState("idle") },
      });
      rzp.on("payment.failed", (r) => {
        setError(r.error?.description || "Payment failed. You can try again.");
        setState("error");
      });
      rzp.open();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start the payment");
      setState("error");
    }
  };

  return (
    <div className="mt-5 space-y-3 text-sm">
      <p className="text-zinc-300">Pay <b className="text-gold">{inr(order.total)}</b> securely by card, UPI or netbanking.</p>
      <button onClick={pay} disabled={state === "loading" || state === "verifying"} className="btn btn-red w-full">
        {state === "loading" ? "Opening…" : state === "verifying" ? "Verifying payment…" : `Pay ${inr(order.total)} now`}
      </button>
      {error && <p className="rounded-xl border border-ember/40 bg-ember/10 p-3 text-xs text-ember">{error}</p>}
      <p className="text-[0.7rem] text-smoke">Your order is marked paid only after our server verifies the payment with Razorpay.</p>
    </div>
  );
}

function UtrForm({ order, onUpdated }: { order: Order; onUpdated: (o: Order) => void }) {
  const [utr, setUtr] = useState(order.utr ?? "");
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState("");

  if (order.paymentStatus === "verifying") {
    return (
      <p className="mt-5 flex items-start gap-2 rounded-2xl border border-gold/40 bg-gold/10 p-4 text-sm text-gold">
        <ClockIcon size={18} className="mt-0.5 shrink-0" />
        <span>
          Payment reference <b>{order.utr}</b> received. We&apos;re verifying it — this page updates automatically once your payment is confirmed.
        </span>
      </p>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("saving");
    setError("");
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(order.id)}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ utr, phone: order.customer.phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save");
      onUpdated(data.order ?? { ...order, utr, paymentStatus: "verifying" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
      setState("error");
    }
  };

  return (
    <form onSubmit={submit} className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <label className="block text-left">
        <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Paid? Enter the UPI reference / UTR no.</span>
        <div className="mt-2 flex gap-2">
          <input value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="12-digit UTR" inputMode="numeric" className="input" maxLength={30} required />
          <button disabled={state === "saving"} className="btn btn-gold shrink-0 px-4!">{state === "saving" ? "…" : "Submit"}</button>
        </div>
      </label>
      {error && <p className="mt-2 text-left text-xs text-ember">{error} — you can also send a payment screenshot on WhatsApp.</p>}
      <p className="mt-2 text-left text-[0.7rem] text-smoke">Find it in your UPI app under the payment details. Or just send the payment screenshot on WhatsApp.</p>
    </form>
  );
}
