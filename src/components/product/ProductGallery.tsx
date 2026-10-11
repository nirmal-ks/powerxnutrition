"use client";

import { useRef } from "react";
import type { Product } from "@/types";
import { ProductImage } from "./ProductImage";

/** Big product image with hover-zoom that follows the cursor. */
export function ProductGallery({ product }: { product: Product }) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    ref.current.style.setProperty("--zx", `${((e.clientX - r.left) / r.width) * 100}%`);
    ref.current.style.setProperty("--zy", `${((e.clientY - r.top) / r.height) * 100}%`);
  };

  return (
    <div className="relative">
      <div className="absolute -inset-6 rounded-full bg-blood/20 blur-3xl" />
      <div
        ref={ref}
        onPointerMove={onMove}
        className="group relative aspect-square overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_50%_35%,#ffffff_0%,#ececef_55%,#c9c9d0_100%)] shadow-2xl shadow-black/60"
      >
        <div className="absolute inset-x-16 bottom-8 h-8 rounded-[50%] bg-black/25 blur-lg" />
        <div className="animate-float absolute inset-8 mix-blend-multiply sm:inset-12 [animation-duration:7s]">
          <div className="relative h-full w-full origin-[var(--zx,50%)_var(--zy,50%)] transition-transform duration-300 group-hover:scale-[1.6]">
            <ProductImage
              src={product.image}
              alt={`${product.name} by ${product.brand}`}
              brand={product.brand}
              category={product.category}
              priority
              sizes="(max-width: 1024px) 90vw, 45vw"
            />
          </div>
        </div>
        <span className="font-display absolute left-5 top-5 text-sm tracking-[0.3em] text-black/30">POWERX</span>
      </div>
    </div>
  );
}
