import Link from "next/link";
import { cn } from "@/lib/format";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <Link href="/" aria-label="PowerX Nutrition — home" className={cn("group inline-flex flex-col leading-none select-none", className)}>
      <span className="font-display flex items-end italic text-[1.65rem] tracking-tight text-white">
        POWER
        <span className="relative -ml-0.5 text-[2.1rem] leading-[0.8] text-blood drop-shadow-[0_0_12px_rgba(225,6,0,0.6)] transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110">
          X
        </span>
      </span>
      {!compact && (
        <span className="mt-0.5 text-[0.58rem] font-bold tracking-[0.42em] text-gold">NUTRITION</span>
      )}
    </Link>
  );
}
