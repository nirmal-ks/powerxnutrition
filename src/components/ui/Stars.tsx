import { cn } from "@/lib/format";
import { StarIcon } from "./Icons";

/** Read-only star rating; supports fractions (e.g. 4.3). */
export function Stars({ value, size = 16, className }: { value: number; size?: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <span className={cn("relative inline-flex shrink-0", className)} role="img" aria-label={`${value} out of 5 stars`}>
      <span className="flex text-white/15">
        {Array.from({ length: 5 }, (_, i) => (
          <StarIcon key={i} size={size} />
        ))}
      </span>
      <span className="absolute inset-y-0 left-0 flex overflow-hidden text-gold" style={{ width: `${pct}%` }}>
        {Array.from({ length: 5 }, (_, i) => (
          <StarIcon key={i} size={size} className="shrink-0" />
        ))}
      </span>
    </span>
  );
}
