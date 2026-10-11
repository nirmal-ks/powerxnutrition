"use client";

import { useRef } from "react";
import { cn } from "@/lib/format";

/** 3D tilt + glare that follows the pointer. Pure CSS variables — no animation library. */
export function Tilt({ children, className, max = 10 }: { children: React.ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef(0);

  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const el = ref.current;
    if (!el) return;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      el.style.setProperty("--ry", `${(x - 0.5) * max * 2}deg`);
      el.style.setProperty("--rx", `${(0.5 - y) * max * 2}deg`);
      el.style.setProperty("--mx", `${x * 100}%`);
      el.style.setProperty("--my", `${y * 100}%`);
      el.dataset.active = "true";
    });
  };
  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    cancelAnimationFrame(frame.current);
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    el.dataset.active = "false";
  };

  return (
    <div ref={ref} onPointerMove={onMove} onPointerLeave={onLeave} className={cn("tilt", className)}>
      {children}
      <div className="tilt-glare pointer-events-none absolute inset-0 rounded-[inherit]" />
    </div>
  );
}
