"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/format";

/** Shared building blocks for the side-gutter cartoon scenes (see SideGym.tsx). */

export type Line = { text: string; href?: string };

export const SKIN = "#e8ae78";
export const INK = "#1a1a1a";
export const IRON = "#3f3f46";
export const SHORTS = "#26262b";
export const RED = "var(--color-blood)";
export const GOLD = "var(--color-gold)";

export function useRotating(lines: Line[], every = 5000, offset = 0) {
  const [i, setI] = useState(offset);
  useEffect(() => {
    const t = setInterval(() => !document.hidden && setI((n) => (n + 1) % lines.length), every);
    return () => clearInterval(t);
  }, [lines.length, every]);
  return lines[i % lines.length];
}

/** Shows `text` for `ms` then clears — for tap reactions. */
export function useFlash(ms = 1800) {
  const [text, setText] = useState<string>();
  useEffect(() => {
    if (!text) return;
    const t = setTimeout(() => setText(undefined), ms);
    return () => clearTimeout(t);
  }, [text, ms]);
  return [text, setText] as const;
}

/** Thick cartoon limb: dark outline line with a coloured line on top. */
export const Limb = ({ x1, y1, x2, y2, w = 11, color = SKIN }: { x1: number; y1: number; x2: number; y2: number; w?: number; color?: string }) => (
  <>
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK} strokeWidth={w + 3} strokeLinecap="round" />
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={w} strokeLinecap="round" />
  </>
);

export const Shoe = ({ cx, cy, rx = 10 }: { cx: number; cy: number; rx?: number }) => (
  <ellipse cx={cx} cy={cy} rx={rx} ry="5" fill="#f4f4f5" stroke={INK} strokeWidth="2.5" />
);

export const Ground = ({ cx = 70, rx = 38 }: { cx?: number; rx?: number }) => <ellipse cx={cx} cy="200" rx={rx} ry="5" fill="black" opacity="0.25" />;

type Mood = "smile" | "grin" | "grit" | "sleep" | "o" | "calm";
type Hair = "short" | "spiky" | "bun" | "cap" | "bald";

/** Cartoon head. `look` shifts the eyes/mouth sideways for side-on poses. */
export function Head({ x, y, r = 15, mood = "smile", hair = "short", band, look = 0 }: { x: number; y: number; r?: number; mood?: Mood; hair?: Hair; band?: string; look?: number }) {
  const ex = x + look;
  const eyeY = y + 1;
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={SKIN} stroke={INK} strokeWidth="2.5" />
      {hair === "short" && <path d={`M${x - r + 1} ${y - 4} Q${x} ${y - r - 12} ${x + r - 1} ${y - 4} Q${x} ${y - r + 2} ${x - r + 1} ${y - 4} Z`} fill={INK} />}
      {hair === "spiky" && (
        <path d={`M${x - r} ${y - 3} l3 -12 l4 7 l4 -11 l4 9 l4 -11 l4 9 l4 -8 l3 12 Q${x} ${y - r + 3} ${x - r} ${y - 3} Z`} fill={INK} />
      )}
      {hair === "bun" && (
        <>
          <circle cx={x} cy={y - r - 3} r="6" fill={INK} />
          <path d={`M${x - r + 1} ${y - 3} Q${x} ${y - r - 8} ${x + r - 1} ${y - 3} Q${x} ${y - r + 3} ${x - r + 1} ${y - 3} Z`} fill={INK} />
        </>
      )}
      {hair === "cap" && (
        <>
          <path d={`M${x - r} ${y - 3} Q${x} ${y - r - 12} ${x + r} ${y - 3} Z`} fill={band ?? RED} stroke={INK} strokeWidth="2" />
          <path d={`M${x + (look >= 0 ? r - 4 : -r + 4)} ${y - 4} l${look >= 0 ? 12 : -12} 2 l${look >= 0 ? -12 : 12} 2 Z`} fill={band ?? RED} stroke={INK} strokeWidth="1.5" />
        </>
      )}
      {band && hair !== "cap" && <rect x={x - r} y={y - 9} width={r * 2} height="5.5" rx="2" fill={band} stroke={INK} strokeWidth="1.5" />}
      {mood === "sleep" || mood === "calm" ? (
        <g stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round">
          <path d={`M${ex - 8} ${eyeY} q3 2.5 6 0`} />
          <path d={`M${ex + 2} ${eyeY} q3 2.5 6 0`} />
        </g>
      ) : (
        <g className="gb-blink" style={{ transformOrigin: `${ex}px ${eyeY}px` }}>
          <circle cx={ex - 6} cy={eyeY} r="1.9" fill={INK} />
          <circle cx={ex + 6} cy={eyeY} r="1.9" fill={INK} />
        </g>
      )}
      {mood === "smile" && <path d={`M${ex - 6} ${y + 7} Q${ex} ${y + 11} ${ex + 6} ${y + 7}`} fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />}
      {mood === "calm" && <path d={`M${ex - 4} ${y + 8} Q${ex} ${y + 10} ${ex + 4} ${y + 8}`} fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />}
      {mood === "grin" && <path d={`M${ex - 7} ${y + 6} Q${ex} ${y + 14} ${ex + 7} ${y + 6} Z`} fill={INK} />}
      {mood === "grit" && <rect x={ex - 6} y={y + 6} width="12" height="4" rx="2" fill="#fff" stroke={INK} strokeWidth="1.5" />}
      {mood === "o" && <ellipse cx={ex} cy={y + 8} rx="3" ry="3.5" fill={INK} />}
      {mood === "sleep" && <path d={`M${ex - 3} ${y + 8} h6`} stroke={INK} strokeWidth="1.8" strokeLinecap="round" />}
    </g>
  );
}

function Bubble({ line, override }: { line: Line; override?: string }) {
  const text = override ?? line.text;
  const cls =
    "gb-bubble relative block max-w-[10.5rem] rounded-2xl border border-white/10 bg-coal px-3 py-2 text-center text-xs font-semibold leading-snug text-white shadow-xl shadow-black/40";
  return (
    <div key={text} className="animate-fade-up pointer-events-auto">
      {line.href && !override ? (
        <Link href={line.href} className={cn(cls, "hover:border-gold/50")}>
          {text} <span className="text-gold">→</span>
        </Link>
      ) : (
        <span className={cls}>{text}</span>
      )}
    </div>
  );
}

/** One side of a scene: rotating speech bubble, the tappable drawing, and a stat chip. */
export function Buddy({
  lines,
  offset = 0,
  say,
  label,
  stat,
  onTap,
  tapHint,
  viewBox = "0 0 140 210",
  className,
  children,
  footer,
}: {
  lines: Line[];
  offset?: number;
  say?: string;
  label: string;
  stat: React.ReactNode;
  onTap: () => void;
  tapHint: string;
  viewBox?: string;
  className?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const line = useRotating(lines, 5200, offset);
  return (
    <div className="flex flex-col items-center gap-3">
      <Bubble line={line} override={say} />
      <button type="button" onClick={onTap} aria-label={tapHint} className="pointer-events-auto cursor-pointer">
        <svg viewBox={viewBox} className={cn("w-[clamp(8rem,10vw,12.5rem)] overflow-visible drop-shadow-[0_10px_20px_rgba(0,0,0,0.45)]", className)} aria-hidden>
          {children}
        </svg>
      </button>
      <span className="chip border border-white/10 bg-coal/80 text-[0.65rem]! text-zinc-300">
        {label} <b className="font-display ml-1 text-base text-gold tabular-nums">{stat}</b>
      </span>
      {footer}
    </div>
  );
}

/** Page scroll 0–100, for "progress" style meters. */
export function useScrollPercent() {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        setPct(max > 0 ? Math.min(100, Math.round((window.scrollY / max) * 100)) : 100);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);
  return pct;
}

export function Meter({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="w-32">
      <div className="flex justify-between text-[0.6rem] font-bold uppercase tracking-[0.2em] text-smoke">
        <span>{label}</span>
        <span className={pct >= 98 ? "text-gold" : ""}>{pct}%</span>
      </div>
      <div className="mt-1 h-2.5 overflow-hidden rounded-full border border-white/10 bg-white/5">
        <div className="h-full rounded-full bg-gradient-to-r from-blood to-gold transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
