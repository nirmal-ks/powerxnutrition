"use client";

import Image from "@/components/ui/Img";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { siteConfig } from "@/config/site";
import { INDIAN_STATES } from "@/data/states";
import { cn, inr } from "@/lib/format";
import { distanceFromShopKm, withinCodRadius, type LatLng } from "@/lib/geo";
import { calcTotals, couponDiscount } from "@/lib/pricing";
import { type AppliedCoupon, CouponBox } from "./CouponBox";
import { orderStorageKey } from "@/lib/order-storage";
import type { Customer, Order, PaymentMethod } from "@/types";
import { useCart } from "../cart/CartProvider";
import { ArrowRight, CartIcon, CheckIcon, LockIcon, TruckIcon, WhatsAppIcon } from "../ui/Icons";

const CUSTOMER_KEY = "px_customer_v1";

const COD_KM = siteConfig.delivery.codRadiusKm;

const BASE_PAYMENTS: { id: PaymentMethod; title: string; text: string; badge?: string }[] = [
  { id: "upi", title: "UPI — Pay now", text: "GPay, PhonePe, Paytm, BHIM. Scan the QR for the exact amount after placing the order.", badge: "Fastest" },
  { id: "cod", title: "Cash on Delivery", text: `Pay when your order arrives. Available only within ${COD_KM} km of our shop.` },
  { id: "whatsapp", title: "Confirm on WhatsApp", text: "Place the order and confirm payment & delivery with us on WhatsApp." },
];
const GATEWAY: { id: PaymentMethod; title: string; text: string; badge?: string } = { id: "razorpay", title: "Card / UPI / Netbanking (secure gateway)", text: "Pay online through Razorpay. Confirmed instantly once the payment is verified." };

/** One id per checkout attempt: pressing "Place order" twice (or a network retry) never makes two orders. */
const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

const EMPTY: Customer = { name: "", phone: "", email: "", address: "", city: "", district: "", state: "Tamil Nadu", pincode: "" };

type CodCheck =
  | { status: "idle" | "locating" }
  | { status: "ok" | "far"; coords: LatLng; km: number }
  | { status: "error"; message: string };

export function CheckoutForm({ gatewayEnabled = false }: { gatewayEnabled?: boolean }) {
  const { items, totals, ready, clear } = useCart();
  const router = useRouter();
  const PAYMENTS = gatewayEnabled ? [GATEWAY, ...BASE_PAYMENTS] : BASE_PAYMENTS;
  const clientKey = useRef(newKey());
  const [payment, setPayment] = useState<PaymentMethod>("upi");
  const [c, setC] = useState<Customer>(EMPTY);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Partial<Record<keyof Customer, string>>>({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [cod, setCod] = useState<CodCheck>({ status: "idle" });
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  const discount = coupon ? couponDiscount(coupon.coupon, totals.subtotal) : 0;
  const bill = calcTotals(totals.subtotal, discount);

  const checkCod = () => {
    if (!window.isSecureContext || !navigator.geolocation) {
      setCod({ status: "error", message: "Location isn't available on this connection (needs a secure https site). Please pay by UPI." });
      return;
    }
    setCod({ status: "locating" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const km = distanceFromShopKm(coords);
        setCod({ status: withinCodRadius(km) ? "ok" : "far", coords, km });
      },
      (err) =>
        setCod({
          status: "error",
          message:
            err.code === err.PERMISSION_DENIED
              ? "Location permission was denied. Allow location for this site and try again, or pay by UPI."
              : "Couldn't get your location. Turn on GPS / location and try again.",
        }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  };

  const choosePayment = (id: PaymentMethod) => {
    setPayment(id);
    setServerError("");
    if (id === "cod" && (cod.status === "idle" || cod.status === "error")) checkCod();
  };

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CUSTOMER_KEY) || "null");
      if (saved) setC({ ...EMPTY, ...saved });
    } catch {}
  }, []);

  const set = (k: keyof Customer) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setC((prev) => ({ ...prev, [k]: e.target.value }));
    if (errors[k]) setErrors((prev) => ({ ...prev, [k]: undefined }));
  };

  const validate = () => {
    const e: typeof errors = {};
    if (c.name.trim().length < 2) e.name = "Enter your full name";
    const phone = c.phone.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
    if (!/^[6-9]\d{9}$/.test(phone)) e.phone = "Enter a valid 10-digit mobile number";
    if (c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) e.email = "Enter a valid email";
    if (c.address.trim().length < 8) e.address = "Enter door no, street and area";
    if (!c.city.trim()) e.city = "Enter your city / town";
    if (!c.district.trim()) e.district = "Enter your district";
    if (!c.state) e.state = "Select your state";
    if (!/^[1-9]\d{5}$/.test(c.pincode.trim())) e.pincode = "Enter a valid 6-digit pincode";
    setErrors(e);
    if (Object.keys(e).length) {
      document.getElementById(`f-${Object.keys(e)[0]}`)?.focus();
      return false;
    }
    return true;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError("");
    if (!validate()) return;
    if (payment === "cod" && cod.status !== "ok") {
      setServerError(
        cod.status === "far"
          ? `Cash on Delivery is available only within ${COD_KM} km of our shop. Please choose UPI.`
          : "Tap “Check my location” to confirm Cash on Delivery is available for you, or choose UPI.",
      );
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: c,
          paymentMethod: payment,
          location: payment === "cod" && cod.status === "ok" ? cod.coords : undefined,
          couponCode: discount > 0 ? coupon?.coupon.code : undefined,
          notes,
          clientKey: clientKey.current,
          items: items.map((i) => ({ slug: i.slug, variantId: i.variantId, qty: i.qty })),
        }),
      });
      const data = (await res.json()) as { order?: Order; persisted?: boolean; error?: string };
      if (!res.ok || !data.order) {
        // a definite rejection (e.g. out of stock) → next attempt is a new order; a network error keeps the key
        if (res.status >= 400 && res.status < 500) clientKey.current = newKey();
        throw new Error(data.error || "Could not place the order");
      }
      try {
        localStorage.setItem(CUSTOMER_KEY, JSON.stringify(c));
        sessionStorage.setItem(orderStorageKey(data.order.id), JSON.stringify(data.order));
        localStorage.setItem(orderStorageKey(data.order.id), JSON.stringify(data.order));
      } catch {}
      setPlaced(true);
      router.push(`/order-success?id=${encodeURIComponent(data.order.id)}`);
      clear();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Could not place the order");
      setSubmitting(false);
    }
  };

  if (!ready) return <div className="h-96 animate-pulse rounded-3xl bg-white/5" />;

  if (!items.length && !placed) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
        <CartIcon size={48} className="text-smoke" />
        <h2 className="font-display mt-6 text-4xl">Nothing to checkout</h2>
        <p className="mt-2 text-smoke">Add some products to your cart first.</p>
        <Link href="/shop" className="btn btn-red mt-8">Shop now <ArrowRight size={18} /></Link>
      </div>
    );
  }

  const field = (k: keyof Customer, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, span = "") => (
    <label className={cn("block", span)}>
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-400">{label}</span>
      <input
        id={`f-${k}`}
        value={c[k]}
        onChange={set(k)}
        aria-invalid={Boolean(errors[k])}
        className={cn("input", errors[k] && "border-ember!")}
        {...props}
      />
      {errors[k] && <span className="mt-1 block text-xs text-ember">{errors[k]}</span>}
    </label>
  );

  return (
    <form onSubmit={submit} noValidate className="grid gap-8 lg:grid-cols-[1fr_26rem]">
      <div className="space-y-8">
        {/* Step 1: payment */}
        <section className="rounded-3xl border border-white/8 bg-gradient-to-b from-steel to-coal p-5 sm:p-7">
          <h2 className="font-display flex items-center gap-3 text-2xl">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blood text-base text-snow">1</span> Payment method
          </h2>
          <div className="mt-5 grid gap-3" role="radiogroup">
            {PAYMENTS.map((p) => (
              <label
                key={p.id}
                className={cn(
                  "relative flex cursor-pointer items-start gap-4 rounded-2xl border p-4 transition-all",
                  payment === p.id ? "border-gold bg-gold/[0.07] shadow-[0_0_0_3px_rgba(245,183,0,0.12)]" : "border-white/10 hover:border-white/25",
                )}
              >
                <input type="radio" name="payment" value={p.id} checked={payment === p.id} onChange={() => choosePayment(p.id)} className="sr-only" />
                <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2", payment === p.id ? "border-gold" : "border-zinc-500")}>
                  {payment === p.id && <span className="h-2.5 w-2.5 rounded-full bg-gold" />}
                </span>
                <span className="flex-1">
                  <span className="flex items-center gap-2 font-bold">
                    {p.id === "whatsapp" && <WhatsAppIcon size={16} className="text-[#25d366]" />}
                    {p.title}
                    {p.badge && <span className="chip bg-gold px-2! py-0.5! text-[0.6rem]! text-black">{p.badge}</span>}
                  </span>
                  <span className="mt-0.5 block text-sm text-smoke">{p.text}</span>
                </span>
              </label>
            ))}
          </div>
          {payment === "cod" && (
            <div
              role="status"
              className={cn(
                "mt-4 rounded-2xl border p-4 text-sm",
                cod.status === "ok" ? "border-green-500/30 bg-green-500/10 text-green-300" : cod.status === "far" || cod.status === "error" ? "border-ember/40 bg-ember/10 text-ember" : "border-white/10 bg-white/[0.03] text-zinc-300",
              )}
            >
              {cod.status === "idle" && <p>We need your current location to check Cash on Delivery (only within {COD_KM} km of our shop).</p>}
              {cod.status === "locating" && <p>Checking your location…</p>}
              {cod.status === "ok" && (
                <p className="flex items-start gap-2">
                  <CheckIcon size={18} className="mt-0.5 shrink-0" /> You&apos;re ~{cod.km} km from our shop — Cash on Delivery is available.
                </p>
              )}
              {cod.status === "far" && (
                <p>
                  You&apos;re ~{cod.km} km from our shop. Cash on Delivery is available only within {COD_KM} km — please pay by UPI.{" "}
                  <button type="button" onClick={() => choosePayment("upi")} className="font-bold underline">Switch to UPI</button>
                </p>
              )}
              {cod.status === "error" && <p>{cod.message}</p>}
              {cod.status !== "locating" && cod.status !== "ok" && (
                <button type="button" onClick={checkCod} className="btn btn-ghost mt-3 py-2! text-xs!">Check my location</button>
              )}
            </div>
          )}
        </section>

        {/* Step 2: details */}
        <section className="rounded-3xl border border-white/8 bg-gradient-to-b from-steel to-coal p-5 sm:p-7">
          <h2 className="font-display flex items-center gap-3 text-2xl">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blood text-base text-snow">2</span> Delivery details
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {field("name", "Full name *", { autoComplete: "name", placeholder: "Your name" }, "sm:col-span-2")}
            {field("phone", "Mobile number *", { autoComplete: "tel", inputMode: "tel", placeholder: "10-digit mobile", maxLength: 14 })}
            {field("email", "Email (optional)", { autoComplete: "email", type: "email", placeholder: "you@example.com" })}
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-400">Address *</span>
              <textarea
                id="f-address"
                value={c.address}
                onChange={set("address")}
                rows={2}
                autoComplete="street-address"
                placeholder="Door no, street, area, landmark"
                aria-invalid={Boolean(errors.address)}
                className={cn("input resize-none", errors.address && "border-ember!")}
              />
              {errors.address && <span className="mt-1 block text-xs text-ember">{errors.address}</span>}
            </label>
            {field("city", "City / Town *", { autoComplete: "address-level2", placeholder: "e.g. Veppampattu" })}
            {field("district", "District *", { placeholder: "e.g. Tiruvallur" })}
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-400">State *</span>
              <select id="f-state" value={c.state} onChange={set("state")} className={cn("input", errors.state && "border-ember!")} autoComplete="address-level1">
                {INDIAN_STATES.map((s) => (
                  <option key={s} value={s} className="bg-coal">{s}</option>
                ))}
              </select>
            </label>
            {field("pincode", "Pincode *", { autoComplete: "postal-code", inputMode: "numeric", placeholder: "6-digit pincode", maxLength: 6 })}
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-400">Order note (optional)</span>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} placeholder="Flavour preference, delivery time, etc." className="input" />
            </label>
          </div>
        </section>
      </div>

      {/* Summary */}
      <aside className="lg:sticky lg:top-28 lg:self-start">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-steel to-coal p-5 sm:p-6">
          <h2 className="font-display text-2xl">Your order</h2>
          <ul className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1">
            {items.map((i) => (
              <li key={i.slug + i.variantId} className="flex items-center gap-3">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gradient-to-b from-snow to-zinc-200">
                  {i.image && <Image src={i.image} alt="" fill sizes="56px" className="object-contain p-1 mix-blend-multiply" />}
                  <span className="absolute -right-0 -top-0 flex h-5 min-w-5 items-center justify-center rounded-bl-lg bg-blood px-1 text-[0.65rem] font-bold">{i.qty}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{i.name}</p>
                  <p className="text-xs text-smoke">{i.variantLabel}</p>
                </div>
                <span className="text-sm font-bold">{inr(i.price * i.qty)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 border-t border-white/10 pt-4">
            <CouponBox subtotal={totals.subtotal} phone={c.phone} applied={coupon} onChange={setCoupon} />
          </div>
          <dl className="mt-5 space-y-2 border-t border-white/10 pt-4 text-sm">
            <div className="flex justify-between text-zinc-300"><dt>Subtotal</dt><dd>{inr(bill.subtotal)}</dd></div>
            {bill.discount > 0 && (
              <div className="flex justify-between text-green-400"><dt>Coupon ({coupon?.coupon.code})</dt><dd>− {inr(bill.discount)}</dd></div>
            )}
            <div className="flex justify-between text-zinc-300">
              <dt className="flex items-center gap-1.5"><TruckIcon size={14} /> Delivery</dt>
              <dd className={bill.delivery ? "" : "font-bold text-green-400"}>{bill.delivery ? inr(bill.delivery) : "FREE"}</dd>
            </div>
            <div className="flex justify-between pt-2 text-xl font-extrabold"><dt>Total</dt><dd className="text-gold">{inr(bill.total)}</dd></div>
          </dl>
          {serverError && <p className="mt-4 rounded-xl border border-ember/40 bg-ember/10 p-3 text-sm text-ember" role="alert">{serverError}</p>}
          <button type="submit" disabled={submitting || placed} className="btn btn-red shine mt-5 w-full py-4!">
            {submitting || placed ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <LockIcon size={18} />
            )}
            {submitting || placed ? "Placing order…" : payment === "upi" || payment === "razorpay" ? `Proceed to pay · ${inr(bill.total)}` : `Place order · ${inr(bill.total)}`}
          </button>
          <ul className="mt-4 space-y-1.5 text-xs text-smoke">
            <li className="flex items-center gap-2"><CheckIcon size={14} className="text-green-400" /> You&apos;ll get an Order ID instantly</li>
            <li className="flex items-center gap-2"><CheckIcon size={14} className="text-green-400" /> Send the order to us on WhatsApp in one tap</li>
            <li className="flex items-center gap-2"><CheckIcon size={14} className="text-green-400" /> We never ask for card details or OTPs</li>
          </ul>
          <p className="mt-4 text-[0.7rem] text-smoke">
            By placing the order you agree to our <Link href="/terms-and-conditions" className="underline">Terms</Link> and{" "}
            <Link href="/refund-policy" className="underline">Refund Policy</Link>.
          </p>
        </div>
      </aside>

      {/* Phone: sticky pay bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-coal/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_30px_rgba(0,0,0,0.4)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-2.5">
          <div className="shrink-0">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-smoke">{bill.discount > 0 ? `Saved ${inr(bill.discount)}` : "Total"}</p>
            <p className="font-display text-2xl leading-none text-gold">{inr(bill.total)}</p>
          </div>
          <button type="submit" disabled={submitting || placed} className="btn btn-red shine h-12 flex-1 px-4!">
            {submitting || placed ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <LockIcon size={16} />}
            {submitting || placed ? "Placing…" : payment === "upi" || payment === "razorpay" ? "Proceed to pay" : "Place order"}
          </button>
        </div>
      </div>
    </form>
  );
}
