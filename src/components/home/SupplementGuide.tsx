"use client";

import Link from "next/link";
import { useState } from "react";
import { categories, categoryUrl } from "@/lib/catalog";
import { cn } from "@/lib/format";
import { ArrowRight, CheckIcon, ClockIcon, DumbbellIcon } from "../ui/Icons";

/** "What it does, when to take & how it helps" — interactive version of the PowerX supplement guide poster. */
export function SupplementGuide() {
  const [active, setActive] = useState(0);
  const cat = categories[active];

  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0" role="tablist">
        {categories.map((c, i) => (
          <button
            key={c.slug}
            role="tab"
            aria-selected={i === active}
            onClick={() => setActive(i)}
            className={cn(
              "group flex shrink-0 items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-all",
              i === active ? "border-gold/50 bg-gold/10" : "border-white/8 bg-white/[0.02] hover:border-white/20",
            )}
          >
            <span>
              <span className={cn("block text-sm font-bold", i === active ? "text-gold" : "text-white")}>{c.name}</span>
              <span className="block text-[0.7rem] text-smoke">{c.tamil}</span>
            </span>
            <ArrowRight size={16} className={cn("hidden transition-transform lg:block", i === active ? "translate-x-0 text-gold" : "-translate-x-1 opacity-0")} />
          </button>
        ))}
      </div>

      <div key={cat.slug} className={cn("theme-dark animate-fade-up relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br p-6 sm:p-10", cat.accent)}>
        <div className="absolute inset-0 bg-black/55" />
        <div className="relative">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/70">{cat.tagline}</p>
          <h3 className="font-display mt-2 text-4xl sm:text-6xl">{cat.name}</h3>
          <p className="mt-1 text-lg text-gold-soft">{cat.tamil}</p>

          <ul className="mt-6 grid gap-2 sm:grid-cols-3">
            {cat.benefits.map((b) => (
              <li key={b} className="flex items-start gap-2 rounded-xl bg-black/30 p-3 text-sm backdrop-blur">
                <CheckIcon size={18} className="mt-0.5 shrink-0 text-green-400" /> {b}
              </li>
            ))}
          </ul>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="glass rounded-2xl p-4">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gold">
                <ClockIcon size={16} /> When to take
              </p>
              <p className="mt-1.5 font-semibold">{cat.when}</p>
            </div>
            <div className="glass rounded-2xl p-4">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gold">
                <DumbbellIcon size={16} /> How to take
              </p>
              <p className="mt-1.5 font-semibold">{cat.how}</p>
            </div>
          </div>
          <Link href={categoryUrl(cat.slug)} className="btn btn-gold mt-6">
            Shop {cat.name} <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </div>
  );
}
