import { inr } from "@/lib/format";
import { TruckIcon } from "../ui/Icons";

export function FreeDeliveryBar({ remaining, freeAbove, subtotal }: { remaining: number; freeAbove: number; subtotal: number }) {
  const pct = Math.min(100, (subtotal / Math.max(1, freeAbove)) * 100);
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
      <p className="flex items-center gap-2 text-xs font-semibold">
        <TruckIcon size={16} className={remaining ? "text-gold" : "text-green-400"} />
        {remaining > 0 ? (
          <span>
            Add <span className="text-gold">{inr(remaining)}</span> more for <b>FREE delivery</b>
          </span>
        ) : (
          <span className="text-green-400">You&apos;ve unlocked FREE delivery!</span>
        )}
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blood via-ember to-gold transition-[width] duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
