"use client";

import { useState } from "react";
import type { Product, Variant } from "@/types";
import { useCart } from "../cart/CartProvider";
import { CheckIcon, PlusIcon } from "../ui/Icons";

/** Floating "+" button on product cards — adds the default size in one tap. */
export function QuickAdd({ product, variant }: { product: Product; variant: Variant }) {
  const { add } = useCart();
  const [done, setDone] = useState(false);

  return (
    <button
      type="button"
      aria-label={`Add ${product.name} (${variant.label}) to cart`}
      onClick={() => {
        add({
          slug: product.slug,
          variantId: variant.id,
          name: product.name,
          brand: product.brand,
          variantLabel: [variant.label, variant.flavour].filter(Boolean).join(" · "),
          image: product.image,
          price: variant.price,
          mrp: variant.mrp,
          maxQty: variant.stock,
        });
        setDone(true);
        setTimeout(() => setDone(false), 1400);
      }}
      className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-snow text-black shadow-xl shadow-black/50 transition-all duration-300 hover:scale-110 hover:bg-gold sm:translate-y-1 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
      style={{ transform: "translateZ(60px)" }}
    >
      {done ? <CheckIcon size={18} className="text-green-600" /> : <PlusIcon size={18} />}
    </button>
  );
}
