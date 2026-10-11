"use client";

import { cn } from "@/lib/format";
import { MinusIcon, PlusIcon } from "../ui/Icons";

export function QtyStepper({ value, max, onChange, small, min = 1 }: { value: number; max: number; onChange: (v: number) => void; small?: boolean; min?: number }) {
  const size = small ? "h-8 w-8" : "h-11 w-11";
  return (
    <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5">
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        className={cn(size, "flex items-center justify-center rounded-full transition-colors hover:bg-white/10 disabled:opacity-30")}
      >
        <MinusIcon size={small ? 14 : 16} />
      </button>
      <span className={cn("min-w-8 text-center font-bold tabular-nums", small ? "text-sm" : "text-base")} aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        className={cn(size, "flex items-center justify-center rounded-full transition-colors hover:bg-white/10 disabled:opacity-30")}
      >
        <PlusIcon size={small ? 14 : 16} />
      </button>
    </div>
  );
}
