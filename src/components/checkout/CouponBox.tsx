"use client";

import { useEffect, useState } from "react";
import { cn, inr } from "@/lib/format";
import { couponDiscount, couponLabel } from "@/lib/pricing";
import type { PublicCoupon } from "@/types";
import { CheckIcon, CloseIcon } from "../ui/Icons";

export type AppliedCoupon = { coupon: PublicCoupon };

/** Coupon field + tappable offers. The discount itself is recomputed from the cart subtotal by the parent. */
export function CouponBox({
  subtotal,
  phone,
  applied,
  onChange,
}: {
  subtotal: number;
  phone: string;
  applied: AppliedCoupon | null;
  onChange: (c: AppliedCoupon | null) => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [offers, setOffers] = useState<PublicCoupon[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/coupons")
      .then((r) => (r.ok ? r.json() : { offers: [] }))
      .then((d: { offers?: PublicCoupon[] }) => setOffers(d.offers ?? []))
      .catch(() => {});
  }, []);

  const apply = async (raw: string) => {
    const value = raw.trim().toUpperCase();
    if (!value) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: value, subtotal, phone }),
      });
      const data = (await res.json()) as { coupon?: PublicCoupon; error?: string };
      if (!res.ok || !data.coupon) throw new Error(data.error || "Couldn't apply this coupon");
      onChange({ coupon: data.coupon });
      setCode("");
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't apply this coupon");
    } finally {
      setBusy(false);
    }
  };

  if (applied) {
    const off = couponDiscount(applied.coupon, subtotal);
    return (
      <div className={cn("flex items-center gap-3 rounded-2xl border border-dashed p-3", off ? "border-green-500/50 bg-green-500/10" : "border-gold/50 bg-gold/10")}>
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-snow", off ? "bg-green-500" : "bg-amber-500")}>
          {off ? <CheckIcon size={18} strokeWidth={3} /> : "!"}
        </span>
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-bold">
            {applied.coupon.code} {off ? <span className="text-green-400">applied</span> : null}
          </p>
          <p className="text-xs text-zinc-300">
            {off ? `You save ${inr(off)} 🎉` : `Add ${inr(applied.coupon.minOrder - subtotal)} more to use this coupon`}
          </p>
        </div>
        <button type="button" onClick={() => onChange(null)} aria-label="Remove coupon" className="rounded-full p-2 text-smoke hover:bg-white/10 hover:text-white">
          <CloseIcon size={16} />
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              apply(code);
            }
          }}
          placeholder="Coupon code"
          autoCapitalize="characters"
          autoComplete="off"
          aria-label="Coupon code"
          className="input uppercase tracking-wider"
        />
        <button type="button" onClick={() => apply(code)} disabled={busy || !code.trim()} className="btn btn-ghost shrink-0 px-4! disabled:opacity-50">
          {busy ? "…" : "Apply"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-ember" role="alert">{error}</p>}
      {offers.length > 0 && (
        <div className="mt-3">
          <button type="button" onClick={() => setOpen((o) => !o)} className="text-xs font-bold text-gold">
            🏷️ {offers.length} offer{offers.length > 1 ? "s" : ""} available {open ? "▴" : "▾"}
          </button>
          {open && (
            <ul className="mt-2 space-y-2">
              {offers.map((o) => {
                const short = Math.max(0, o.minOrder - subtotal);
                return (
                  <li key={o.code}>
                    <button
                      type="button"
                      onClick={() => apply(o.code)}
                      disabled={busy || short > 0}
                      className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-gold/40 bg-gold/[0.05] p-3 text-left transition enabled:hover:border-gold disabled:opacity-60"
                    >
                      <span className="rounded-lg bg-gold px-2 py-1 text-xs font-extrabold tracking-wider text-black">{o.code}</span>
                      <span className="min-w-0 flex-1 text-xs">
                        <span className="block font-bold text-white">{o.description || couponLabel(o)}</span>
                        <span className="block text-smoke">
                          {short > 0 ? `Add ${inr(short)} more to unlock` : o.minOrder ? `On orders above ${inr(o.minOrder)}` : "No minimum"}
                          {o.expiresAt ? ` · till ${o.expiresAt.split("-").reverse().join("/")}` : ""}
                        </span>
                      </span>
                      {short === 0 && <span className="text-xs font-bold text-gold">Apply</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
