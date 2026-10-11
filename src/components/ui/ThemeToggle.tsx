"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/format";
import { THEME_KEY, type Theme } from "@/lib/theme";

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    const root = document.documentElement;
    if (next === "light") root.dataset.theme = "light";
    else delete root.dataset.theme;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {}
  };

  const light = theme === "light";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={light ? "Switch to dark theme" : "Switch to light theme"}
      title={light ? "Dark theme" : "Light theme"}
      className={cn(
        "relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/5 transition-colors hover:border-gold/60 hover:bg-gold/10",
        className,
      )}
    >
      {/* Sun */}
      <svg
        viewBox="0 0 24 24"
        width={20}
        height={20}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        aria-hidden
        className={cn("absolute text-gold transition-all duration-500", light ? "translate-y-8 rotate-90 opacity-0" : "translate-y-0 rotate-0 opacity-100")}
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
      {/* Moon */}
      <svg
        viewBox="0 0 24 24"
        width={19}
        height={19}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className={cn("absolute transition-all duration-500", light ? "translate-y-0 rotate-0 opacity-100" : "-translate-y-8 -rotate-90 opacity-0")}
      >
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
    </button>
  );
}
