"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/format";

/** Small "back to top" button that appears after scrolling down a screen or so. */
export function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 900);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Back to top"
      tabIndex={show ? 0 : -1}
      className={cn(
        // Phones use the bottom tab bar (tap the active tab) instead.
        "fixed bottom-28 right-8 z-30 hidden h-11 w-11 md:flex items-center justify-center rounded-full border border-white/10 bg-coal/90 text-white shadow-xl shadow-black/40 backdrop-blur transition-all hover:border-gold/60 hover:text-gold",
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
      )}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
  );
}
