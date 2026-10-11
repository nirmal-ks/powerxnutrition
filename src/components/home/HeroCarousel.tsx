"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "@/components/ui/Img";
import { productUrl } from "@/lib/catalog";
import { discountPercent, inr } from "@/lib/format";
import { ArrowRight } from "../ui/Icons";

export interface HeroSlide {
  slug: string;
  name: string;
  brand: string;
  image: string;
  price: number;
  mrp: number;
  category: string;
}

const INTERVAL = 3200;

/**
 * Turntable carousel inside the hero circle: the active supplement sits in the centre,
 * its neighbours shrink to the left/right, and everything rotates one step every few seconds.
 */
export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = slides.length;
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);

  const go = useCallback((i: number) => setActive(((i % n) + n) % n), [n]);

  useEffect(() => {
    if (paused || n < 2) return;
    timer.current = setInterval(() => {
      if (!document.hidden) setActive((a) => (a + 1) % n);
    }, INTERVAL);
    return () => clearInterval(timer.current);
  }, [paused, n, active]);

  if (!n) return null;
  const current = slides[active];
  const off = discountPercent(current.price, current.mrp);

  // Position of each slide relative to the active one: 0 = centre, -1 = left, 1 = right, else hidden.
  const offsetOf = (i: number) => {
    let d = i - active;
    if (d > n / 2) d -= n;
    if (d < -n / 2) d += n;
    return d;
  };

  return (
    <div
      className="absolute inset-0"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {/* Podium — everything is clipped to the circle */}
      <div className="absolute inset-[11%] isolate overflow-hidden rounded-full bg-[radial-gradient(circle_at_50%_40%,#ffffff_0%,#e8e8ec_45%,#9a9aa3_100%)] shadow-[0_0_120px_-10px_rgba(225,6,0,0.55),inset_0_-30px_60px_rgba(0,0,0,0.35)]">
        <div className="absolute inset-x-[24%] bottom-[10%] h-[7%] rounded-[50%] bg-black/25 blur-md" />

        {slides.map((s, i) => {
          const d = offsetOf(i);
          const visible = Math.abs(d) <= 1;
          const transform =
            d === 0
              ? "translate(-50%, -52%) scale(1)"
              : d === -1
                ? "translate(-128%, -30%) scale(0.46) rotate(-10deg)"
                : d === 1
                  ? "translate(28%, -30%) scale(0.46) rotate(10deg)"
                  : `translate(-50%, -40%) scale(0.2)`;
          const style: React.CSSProperties = {
            transform,
            opacity: visible ? 1 : 0,
            zIndex: d === 0 ? 3 : visible ? 2 : 1,
            transition: "transform 0.9s cubic-bezier(0.7, 0, 0.2, 1), opacity 0.6s ease",
          };
          const inner = (
            <div key={d === 0 ? `c-${active}` : `s-${i}`} className={d === 0 ? "hero-spin-in h-full w-full" : "h-full w-full"}>
              <div className={d === 0 ? "animate-float relative h-full w-full" : "relative h-full w-full"}>
                <Image
                  src={s.image}
                  alt={s.name}
                  fill
                  priority={i === 0}
                  sizes="(max-width: 640px) 60vw, 320px"
                  className="object-contain"
                />
              </div>
            </div>
          );
          return (
            // Stable wrapper per slide so the position change animates smoothly
            <div
              key={s.slug}
              aria-hidden={!visible}
              className="absolute left-1/2 top-1/2 h-[68%] w-[56%] mix-blend-multiply brightness-105 contrast-105"
              style={style}
            >
              {d === 0 ? (
                <Link href={productUrl(s.slug)} aria-label={`${s.name} — ${inr(s.price)}`} className="block h-full w-full">
                  {inner}
                </Link>
              ) : (
                <button type="button" tabIndex={visible ? 0 : -1} aria-label={`Show ${s.name}`} onClick={() => go(i)} className="block h-full w-full cursor-pointer">
                  {inner}
                </button>
              )}
            </div>
          );
        })}

        {/* Light sweep + ring pulse on every change */}
        <div key={`sweep-${active}`} className="hero-sweep pointer-events-none absolute inset-y-0 left-0 z-10 w-1/3 bg-gradient-to-r from-transparent via-white/70 to-transparent" />
      </div>
      <div key={`ring-${active}`} className="hero-ring pointer-events-none absolute inset-[11%] rounded-full border-2 border-blood" />

      {/* Current product label */}
      <div className="absolute inset-x-0 -bottom-32 flex flex-col items-center text-center sm:-bottom-28" aria-live="polite">
        <div key={current.slug} className="animate-fade-up">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.25em] text-gold">
            {current.brand} · {current.category}
          </p>
          <Link href={productUrl(current.slug)} className="mt-1 inline-flex items-center gap-2 font-semibold hover:text-gold">
            {current.name}
          </Link>
          <p className="mt-1 flex items-center justify-center gap-2 text-sm">
            <b className="text-lg">{inr(current.price)}</b>
            {off > 0 && (
              <>
                <span className="text-smoke line-through">{inr(current.mrp)}</span>
                <span className="chip bg-blood px-2! py-0.5! text-[0.6rem]! text-snow">{off}% off</span>
              </>
            )}
          </p>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button type="button" onClick={() => go(active - 1)} aria-label="Previous product" className="flex h-8 w-8 rotate-180 items-center justify-center rounded-full border border-white/15 hover:border-gold hover:text-gold">
            <ArrowRight size={14} />
          </button>
          <div className="flex items-center gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.slug}
                type="button"
                onClick={() => go(i)}
                aria-label={`Show ${s.name}`}
                aria-current={i === active}
                className={`relative h-1.5 overflow-hidden rounded-full bg-white/15 transition-all duration-500 ${i === active ? "w-8" : "w-1.5 hover:bg-white/40"}`}
              >
                {i === active && (
                  <span
                    key={`${active}-${paused}`}
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-blood to-gold"
                    style={{ animation: paused ? "none" : `hero-dot ${INTERVAL}ms linear forwards`, width: paused ? "100%" : undefined }}
                  />
                )}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => go(active + 1)} aria-label="Next product" className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 hover:border-gold hover:text-gold">
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
