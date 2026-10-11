"use client";

import Image from "@/components/ui/Img";
import Link from "next/link";
import { productUrl } from "@/lib/catalog";
import { discountPercent, inr } from "@/lib/format";
import { cartEnquiryMessage, whatsappLink } from "@/lib/whatsapp";
import { ArrowRight, CartIcon, LockIcon, TrashIcon, WhatsAppIcon } from "../ui/Icons";
import { useCart } from "./CartProvider";
import { FreeDeliveryBar } from "./FreeDeliveryBar";
import { QtyStepper } from "./QtyStepper";

export function CartView() {
  const { items, totals, setQty, remove, ready, clear } = useCart();

  if (!ready) return <div className="h-64 animate-pulse rounded-3xl bg-white/5" />;

  if (!items.length) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/5 text-smoke">
          <CartIcon size={44} />
        </div>
        <h2 className="font-display mt-6 text-4xl">Your cart is empty</h2>
        <p className="mt-2 text-smoke">Looks like you haven&apos;t added any fuel yet.</p>
        <Link href="/shop" className="btn btn-red shine mt-8">
          Continue shopping <ArrowRight size={18} />
        </Link>
      </div>
    );
  }

  const savings = items.reduce((s, i) => s + Math.max(0, i.mrp - i.price) * i.qty, 0);

  return (
    <div className="grid gap-8 pb-20 md:pb-0 lg:grid-cols-[1fr_24rem]">
      {/* Phone: sticky checkout bar above the tab bar */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-white/10 bg-steel/95 backdrop-blur-xl md:hidden">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <div className="shrink-0">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-smoke">{items.reduce((s, i) => s + i.qty, 0)} items</p>
            <p className="font-display text-2xl leading-none text-gold">{inr(totals.total)}</p>
          </div>
          <Link href="/checkout" className="btn btn-red shine h-12 flex-1">
            <LockIcon size={16} /> Checkout
          </Link>
        </div>
      </div>
      <div>
        <ul className="space-y-3">
          {items.map((i) => {
            const off = discountPercent(i.price, i.mrp);
            return (
              <li key={i.slug + i.variantId} className="flex gap-4 rounded-3xl border border-white/8 bg-gradient-to-r from-steel to-coal p-3 sm:p-4">
                <Link href={productUrl(i.slug)} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-b from-snow to-zinc-200 sm:h-28 sm:w-28">
                  {i.image && <Image src={i.image} alt={i.name} fill sizes="112px" className="object-contain p-2 mix-blend-multiply" />}
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-gold">{i.brand}</p>
                      <Link href={productUrl(i.slug)} className="line-clamp-2 font-semibold leading-tight hover:text-gold">
                        {i.name}
                      </Link>
                      <p className="mt-0.5 text-xs text-smoke">Size: {i.variantLabel}</p>
                    </div>
                    <button onClick={() => remove(i.slug, i.variantId)} aria-label={`Remove ${i.name}`} className="rounded-full p-2 text-smoke transition hover:bg-blood/15 hover:text-ember">
                      <TrashIcon size={18} />
                    </button>
                  </div>
                  <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-3">
                    <QtyStepper value={i.qty} max={i.maxQty} min={0} onChange={(q) => setQty(i.slug, i.variantId, q)} small />
                    <div className="text-right leading-tight">
                      <p className="text-lg font-extrabold">{inr(i.price * i.qty)}</p>
                      <p className="text-xs text-smoke">
                        {inr(i.price)} each{off > 0 && <span className="ml-1 text-green-400">({off}% off)</span>}
                      </p>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <Link href="/shop" className="btn btn-ghost">
            ← Continue shopping
          </Link>
          <button onClick={clear} className="text-xs font-bold uppercase tracking-widest text-smoke hover:text-ember">
            Clear cart
          </button>
        </div>
      </div>

      <aside className="lg:sticky lg:top-28 lg:self-start">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-steel to-coal p-6">
          <h2 className="font-display text-3xl">Order summary</h2>
          <div className="mt-4">
            <FreeDeliveryBar remaining={totals.remainingForFree} freeAbove={totals.freeAbove} subtotal={totals.subtotal} />
          </div>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between text-zinc-300">
              <dt>Subtotal ({items.reduce((s, i) => s + i.qty, 0)} items)</dt>
              <dd>{inr(totals.subtotal)}</dd>
            </div>
            <div className="flex justify-between text-zinc-300">
              <dt>Delivery charge</dt>
              <dd className={totals.delivery ? "" : "font-bold text-green-400"}>{totals.delivery ? inr(totals.delivery) : "FREE"}</dd>
            </div>
            {savings > 0 && (
              <div className="flex justify-between text-green-400">
                <dt>You save on MRP</dt>
                <dd>− {inr(savings)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-white/10 pt-4 text-xl font-extrabold">
              <dt>Total amount</dt>
              <dd className="text-gold">{inr(totals.total)}</dd>
            </div>
          </dl>
          <Link href="/checkout" className="btn btn-red shine mt-6 w-full py-4!">
            <LockIcon size={18} /> Proceed to checkout
          </Link>
          <a href={whatsappLink(cartEnquiryMessage(items, totals.total))} target="_blank" rel="noopener" className="btn btn-ghost mt-3 w-full">
            <WhatsAppIcon size={18} className="text-[#25d366]" /> Order via WhatsApp
          </a>
          <p className="mt-4 text-center text-xs text-smoke">UPI (GPay, PhonePe, Paytm) · Coupons applied at checkout</p>
        </div>
      </aside>
    </div>
  );
}
