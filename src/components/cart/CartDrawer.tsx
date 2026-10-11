"use client";

import Image from "@/components/ui/Img";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { productUrl } from "@/lib/catalog";
import { cn, inr } from "@/lib/format";
import { useCart } from "./CartProvider";
import { ArrowRight, CartIcon, CheckIcon, CloseIcon } from "../ui/Icons";
import { QtyStepper } from "./QtyStepper";
import { FreeDeliveryBar } from "./FreeDeliveryBar";

export function CartDrawer() {
  const { items, drawerOpen, closeDrawer, totals, setQty, remove, count } = useCart();
  const pathname = usePathname();

  useEffect(() => closeDrawer(), [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeDrawer();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [drawerOpen, closeDrawer]);

  return (
    <div className={cn("fixed inset-0 z-50", drawerOpen ? "visible" : "invisible")} aria-hidden={!drawerOpen}>
      <div
        className={cn("absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300", drawerOpen ? "opacity-100" : "opacity-0")}
        onClick={closeDrawer}
      />
      <aside
        role="dialog"
        aria-label="Shopping cart"
        className={cn(
          "absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-white/10 bg-coal shadow-2xl transition-transform duration-400 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
          drawerOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <h2 className="font-display text-2xl">
            Your Cart <span className="text-gold">({count})</span>
          </h2>
          <button onClick={closeDrawer} aria-label="Close cart" className="rounded-full p-2 hover:bg-white/10">
            <CloseIcon />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/5 text-smoke">
              <CartIcon size={36} />
            </div>
            <p className="font-display text-2xl">Your cart is empty</p>
            <p className="text-sm text-smoke">Fuel up — your next PR starts here.</p>
            <Link href="/shop" className="btn btn-red mt-2">
              Shop now <ArrowRight size={18} />
            </Link>
          </div>
        ) : (
          <>
            <div className="px-5 pt-4">
              <FreeDeliveryBar remaining={totals.remainingForFree} freeAbove={totals.freeAbove} subtotal={totals.subtotal} />
            </div>
            <ul className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {items.map((i) => (
                <li key={i.slug + i.variantId} className="flex gap-3 rounded-2xl border border-white/6 bg-white/[0.03] p-3">
                  <Link href={productUrl(i.slug)} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gradient-to-b from-snow to-zinc-200">
                    {i.image && <Image src={i.image} alt={i.name} fill sizes="80px" className="object-contain p-1.5 mix-blend-multiply" />}
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <Link href={productUrl(i.slug)} className="line-clamp-2 text-sm font-semibold leading-tight hover:text-gold">
                      {i.name}
                    </Link>
                    <span className="mt-0.5 text-xs text-smoke">{i.variantLabel}</span>
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <QtyStepper value={i.qty} max={i.maxQty} onChange={(q) => setQty(i.slug, i.variantId, q)} small min={0} />
                      <span className="font-bold">{inr(i.price * i.qty)}</span>
                    </div>
                  </div>
                  <button onClick={() => remove(i.slug, i.variantId)} aria-label={`Remove ${i.name}`} className="self-start p-1 text-smoke hover:text-ember">
                    <CloseIcon size={16} />
                  </button>
                </li>
              ))}
            </ul>
            <div className="space-y-3 border-t border-white/8 bg-ink/60 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
              <div className="flex justify-between text-sm text-zinc-300">
                <span>Subtotal</span>
                <span>{inr(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-zinc-300">
                <span>Delivery</span>
                <span className={totals.delivery ? "" : "font-bold text-green-400"}>{totals.delivery ? inr(totals.delivery) : "FREE"}</span>
              </div>
              <div className="flex justify-between text-lg font-extrabold">
                <span>Total</span>
                <span className="text-gold">{inr(totals.total)}</span>
              </div>
              <Link href="/checkout" className="btn btn-red shine w-full">
                Checkout securely <ArrowRight size={18} />
              </Link>
              <Link href="/cart" className="block text-center text-xs font-semibold uppercase tracking-widest text-smoke hover:text-white">
                View full cart
              </Link>
              <p className="flex items-center justify-center gap-1.5 text-[0.7rem] text-smoke">
                <CheckIcon size={14} className="text-green-400" /> Cash on Delivery · UPI · WhatsApp ordering
              </p>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
