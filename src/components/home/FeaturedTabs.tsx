"use client";

import { useState } from "react";
import { cn } from "@/lib/format";
import type { CategorySlug, Product } from "@/types";

const TABS: { key: "all" | CategorySlug; label: string }[] = [
  { key: "all", label: "Bestsellers" },
  { key: "whey-protein", label: "Whey Protein" },
  { key: "creatine", label: "Creatine" },
  { key: "mass-gainer", label: "Mass Gainer" },
  { key: "pre-workout", label: "Pre-Workout" },
  { key: "vitamins", label: "Vitamins" },
];

/** Tab bar that filters pre-rendered product cards (cards stay server components). */
export function FeaturedTabs({ products, cards }: { products: Product[]; cards: Record<string, React.ReactNode> }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("all");
  const list = (tab === "all" ? products.filter((p) => p.featured) : products.filter((p) => p.category === tab)).slice(0, 8);

  return (
    <>
      <div className="no-scrollbar -mx-4 mb-8 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "shrink-0 rounded-full border px-5 py-2.5 text-xs font-extrabold uppercase tracking-wider transition-all duration-300",
              tab === t.key
                ? "border-transparent bg-gradient-to-r from-blood to-ember text-snow shadow-lg shadow-blood/40"
                : "border-white/10 bg-white/[0.03] text-zinc-400 hover:border-white/30 hover:text-white",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div key={tab} className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
        {list.map((p, i) => (
          <div key={p.slug} className="animate-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
            {cards[p.slug]}
          </div>
        ))}
      </div>
    </>
  );
}
