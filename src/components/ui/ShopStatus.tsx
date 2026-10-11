"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/format";
import { getShopStatus, type ShopStatus as Status } from "@/lib/shop-hours";

/**
 * Live "Open now · Closes at 9:30 PM" / "Closed · Opens at 9:00 AM" badge.
 * Rendered only after mount (the answer depends on the current time) and refreshed every 30 s.
 */
export function ShopStatus({ className, showDetail = true }: { className?: string; showDetail?: boolean }) {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    const tick = () => setStatus(getShopStatus());
    tick();
    const t = setInterval(tick, 30000);
    return () => clearInterval(t);
  }, []);

  if (!status) return <span className={cn("inline-block h-5 w-28 animate-pulse rounded-full bg-white/5", className)} aria-hidden />;

  const tone = status.open ? (status.closingSoon ? "amber" : "green") : "red";
  return (
    <span className={cn("inline-flex items-center gap-2 text-xs font-semibold", className)} role="status">
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        {status.open && (
          <span className={cn("absolute inset-0 animate-ping rounded-full opacity-60", tone === "green" ? "bg-green-400" : "bg-amber-400")} />
        )}
        <span className={cn("relative h-2.5 w-2.5 rounded-full", tone === "green" ? "bg-green-400" : tone === "amber" ? "bg-amber-400" : "bg-red-500")} />
      </span>
      <span className={cn("font-bold", tone === "green" ? "text-green-400" : tone === "amber" ? "text-amber-400" : "text-red-400")}>
        {status.open ? (status.closingSoon ? "Closing soon" : "Open now") : "Closed"}
      </span>
      {showDetail && <span className="text-smoke">· {status.detail}</span>}
    </span>
  );
}
