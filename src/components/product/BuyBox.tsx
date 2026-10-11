"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { siteConfig } from "@/config/site";
import { defaultVariant } from "@/lib/catalog";
import { cn, discountPercent, inr } from "@/lib/format";
import { productEnquiryMessage, whatsappLink } from "@/lib/whatsapp";
import type { Product } from "@/types";
import { useCart } from "../cart/CartProvider";
import { QtyStepper } from "../cart/QtyStepper";
import { BoltIcon, CartIcon, CheckIcon, ShieldIcon, TruckIcon, WhatsAppIcon } from "../ui/Icons";

export function BuyBox({ product: initial }: { product: Product }) {
  const { add } = useCart();
  const router = useRouter();
  const [variantId, setVariantId] = useState(defaultVariant(initial).id);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  // The page may be a few minutes old (cached); fetch live stock & price so we never promise stale availability.
  const [live, setLive] = useState<{ at: string; variants: Record<string, { stock: number; price: number }> } | null>(null);
  useEffect(() => {
    let stop = false;
    const load = () =>
      fetch(`/api/stock?slug=${encodeURIComponent(initial.slug)}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => !stop && d && setLive({ at: d.checkedAt, variants: d.variants }))
        .catch(() => undefined);
    load();
    const t = setInterval(() => !document.hidden && load(), 60_000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [initial.slug]);
  const product = live
    ? { ...initial, variants: initial.variants.map((x) => (live.variants[x.id] ? { ...x, ...live.variants[x.id] } : { ...x, stock: 0 })) }
    : initial;

  const v = product.variants.find((x) => x.id === variantId) ?? product.variants[0];
  const off = discountPercent(v.price, v.mrp);
  const available = v.stock > 0;
  const hasFlavours = product.variants.some((x) => x.flavour);
  const sizes = [...new Set(product.variants.map((x) => x.label))];
  const flavoursForSize = product.variants.filter((x) => x.label === v.label);
  const fullLabel = [v.label, v.flavour].filter(Boolean).join(" · ");

  const addToCart = (silent = false) =>
    add(
      {
        slug: product.slug,
        variantId: v.id,
        name: product.name,
        brand: product.brand,
        variantLabel: fullLabel,
        image: product.image,
        price: v.price,
        mrp: v.mrp,
        maxQty: v.stock,
      },
      qty,
      { silent },
    );

  return (
    <div className="space-y-6">
      {/* Price */}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <span key={v.id} className="animate-fade-up font-display text-5xl text-white">{inr(v.price)}</span>
        {off > 0 && (
          <>
            <span className="pb-1.5 text-lg text-smoke line-through">MRP {inr(v.mrp)}</span>
            <span className="chip mb-2 bg-blood text-snow">Save {off}%</span>
          </>
        )}
      </div>
      <p className="-mt-4 text-xs text-smoke">Inclusive of all taxes</p>

      {/* Sizes (and flavours, when the product has them) */}
      {hasFlavours ? (
        <div className="space-y-4">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-smoke">
              Size: <span className="text-white">{v.label}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {sizes.map((s) => {
                const options = product.variants.filter((x) => x.label === s);
                const inStockOpt = options.find((x) => x.stock > 0) ?? options[0];
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setVariantId((options.find((x) => x.flavour === v.flavour && x.stock > 0) ?? inStockOpt).id);
                      setQty(1);
                    }}
                    aria-pressed={s === v.label}
                    className={cn("rounded-2xl border px-4 py-3 text-left transition-all", s === v.label ? "border-gold bg-gold/10" : "border-white/10 hover:border-white/30", options.every((x) => x.stock <= 0) && "opacity-50")}
                  >
                    <span className="block text-sm font-bold">{s}</span>
                    <span className="block text-xs text-smoke">{options.some((x) => x.stock > 0) ? `from ${inr(Math.min(...options.map((x) => x.price)))}` : "Sold out"}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-smoke">
              Flavour: <span className="text-white">{v.flavour || "—"}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {flavoursForSize.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => {
                    setVariantId(x.id);
                    setQty(1);
                  }}
                  aria-pressed={x.id === v.id}
                  className={cn("rounded-full border px-4 py-2 text-sm font-semibold transition-all", x.id === v.id ? "border-gold bg-gold/10" : "border-white/10 hover:border-white/30", x.stock <= 0 && "opacity-50 line-through")}
                >
                  {x.flavour || "Regular"}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
      <div>
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-smoke">
          Size: <span className="text-white">{v.label}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {product.variants.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => {
                setVariantId(x.id);
                setQty(1);
              }}
              aria-pressed={x.id === v.id}
              className={cn(
                "relative rounded-2xl border px-4 py-3 text-left transition-all",
                x.id === v.id ? "border-gold bg-gold/10 shadow-[0_0_0_3px_rgba(245,183,0,0.15)]" : "border-white/10 hover:border-white/30",
                x.stock <= 0 && "opacity-50",
              )}
            >
              <span className="block text-sm font-bold">{x.label}</span>
              <span className="block text-xs text-smoke">{x.stock > 0 ? inr(x.price) : "Sold out"}</span>
            </button>
          ))}
        </div>
      </div>
      )}

      {/* Stock */}
      <p className={cn("flex items-center gap-2 text-sm font-semibold", available ? (v.stock <= 2 ? "text-ember" : "text-green-400") : "text-smoke")}>
        <span className={cn("h-2.5 w-2.5 rounded-full", available ? (v.stock <= 2 ? "bg-ember animate-pulse" : "bg-green-400") : "bg-zinc-500")} />
        {available ? (v.stock <= 2 ? `Hurry — only ${v.stock} left in stock` : "In stock · ready to ship") : "Out of stock"}
        {!live && <span className="text-[0.65rem] font-normal text-smoke">(checking live stock…)</span>}
      </p>

      {available ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <QtyStepper value={qty} max={v.stock} onChange={setQty} />
            <button
              type="button"
              onClick={() => {
                addToCart();
                setAdded(true);
                setTimeout(() => setAdded(false), 1600);
              }}
              className="btn btn-gold flex-1"
            >
              {added ? <CheckIcon size={18} /> : <CartIcon size={18} />} {added ? "Added!" : "Add to cart"}
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              addToCart(true);
              router.push("/checkout");
            }}
            className="btn btn-red shine w-full py-4!"
          >
            <BoltIcon size={18} /> Buy now
          </button>
        </div>
      ) : (
        <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-300">
          This size is sold out. Message us on WhatsApp and we&apos;ll tell you as soon as it&apos;s back.
        </p>
      )}

      <a
        href={whatsappLink(productEnquiryMessage(product.name, fullLabel))}
        target="_blank"
        rel="noopener"
        className="btn btn-ghost w-full"
      >
        <WhatsAppIcon size={18} className="text-[#25d366]" /> {available ? "Order / ask on WhatsApp" : "Notify me on WhatsApp"}
      </a>

      {/* Phone: sticky buy bar, like shopping apps */}
      <div className="fixed inset-x-0 bottom-0 z-40 my-0! border-t border-white/10 bg-coal/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_30px_rgba(0,0,0,0.4)] backdrop-blur-xl md:hidden">
        <div className="flex items-center gap-2 px-4 py-2.5">
          <div className="min-w-0 pr-1">
            <p className="truncate text-[0.65rem] font-semibold uppercase tracking-wider text-smoke">{fullLabel}</p>
            <p className="font-display text-2xl leading-none text-white">{inr(v.price)}</p>
          </div>
          {available ? (
            <>
              <button
                type="button"
                onClick={() => {
                  addToCart();
                  setAdded(true);
                  setTimeout(() => setAdded(false), 1600);
                }}
                aria-label="Add to cart"
                className="btn btn-ghost ml-auto h-12 w-12 shrink-0 p-0!"
              >
                {added ? <CheckIcon size={20} className="text-green-400" /> : <CartIcon size={20} />}
              </button>
              <button
                type="button"
                onClick={() => {
                  addToCart(true);
                  router.push("/checkout");
                }}
                className="btn btn-red h-12 flex-1 px-4!"
              >
                <BoltIcon size={16} /> Buy now
              </button>
            </>
          ) : (
            <a href={whatsappLink(productEnquiryMessage(product.name, fullLabel))} target="_blank" rel="noopener" className="btn btn-whatsapp ml-auto h-12 flex-1">
              <WhatsAppIcon size={18} /> Notify me
            </a>
          )}
        </div>
      </div>

      <ul className="grid grid-cols-3 gap-2 text-center text-[0.7rem] font-semibold text-zinc-300">
        <li className="glass rounded-2xl p-3">
          <ShieldIcon size={20} className="mx-auto mb-1 text-gold" /> 100% Genuine
        </li>
        <li className="glass rounded-2xl p-3">
          <TruckIcon size={20} className="mx-auto mb-1 text-gold" />
          {v.price * qty >= siteConfig.delivery.freeAbove ? "Free delivery" : "Fast delivery"}
        </li>
        <li className="glass rounded-2xl p-3">
          <CheckIcon size={20} className="mx-auto mb-1 text-gold" /> UPI · COD within {siteConfig.delivery.codRadiusKm} km
        </li>
      </ul>
    </div>
  );
}
