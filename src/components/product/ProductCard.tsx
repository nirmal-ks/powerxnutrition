import Link from "next/link";
import { categoryBySlug, defaultVariant, inStock, productUrl } from "@/lib/catalog";
import { discountPercent, inr } from "@/lib/format";
import type { Product } from "@/types";
import { Tilt } from "../ui/Tilt";
import { ProductImage } from "./ProductImage";
import { QuickAdd } from "./QuickAdd";

export function ProductCard({
  product,
  priority = false,
  delay = 0,
  reveal = true,
}: {
  product: Product;
  priority?: boolean;
  delay?: number;
  reveal?: boolean;
}) {
  const v = defaultVariant(product);
  const off = discountPercent(v.price, v.mrp);
  const available = inStock(product);
  const lowStock = available && v.stock > 0 && v.stock <= 2;
  const cat = categoryBySlug(product.category);

  return (
    <div data-reveal={reveal ? "" : undefined} style={{ "--delay": `${delay}ms` } as React.CSSProperties} className="h-full">
      <Tilt className="group relative h-full rounded-3xl border border-white/8 bg-gradient-to-b from-steel to-coal p-3 hover:border-gold/40 hover:shadow-[0_30px_60px_-25px_rgba(225,6,0,0.55)]">
        <Link href={productUrl(product.slug)} className="flex h-full flex-col" aria-label={`${product.name} — ${inr(v.price)}`}>
          {/* Image stage */}
          <div className="relative aspect-square overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_50%_35%,#ffffff_0%,#ececef_55%,#cfcfd6_100%)]">
            <div className="absolute inset-x-8 bottom-3 h-5 rounded-[50%] bg-black/25 blur-md transition-all duration-500 group-hover:inset-x-12 group-hover:opacity-50" />
            <div className="absolute -inset-x-4 -bottom-10 h-1/2 bg-blood/0 blur-3xl transition-colors duration-500 group-hover:bg-blood/25" />
            <div className="tilt-pop absolute inset-4 mix-blend-multiply transition-transform duration-500 group-hover:-translate-y-2 group-hover:scale-[1.06]">
              <div className="relative h-full w-full">
                <ProductImage
                  src={product.image}
                  alt={product.name}
                  brand={product.brand}
                  category={product.category}
                  priority={priority}
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 22vw"
                />
              </div>
            </div>
            <div className="absolute left-2 top-2 flex flex-col gap-1.5">
              {off > 0 && <span className="chip bg-blood text-snow shadow-lg shadow-blood/40">{off}% OFF</span>}
              {product.featured && <span className="chip bg-gold text-black">Bestseller</span>}
            </div>
            {!available && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-[2px]">
                <span className="chip border border-white/20 bg-black/70 text-snow">Out of stock</span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-1 flex-col px-1 pb-1 pt-3">
            <div className="flex items-center justify-between gap-2 text-[0.65rem] font-bold uppercase tracking-[0.16em]">
              <span className="truncate text-gold">{product.brand}</span>
              <span className="hidden shrink-0 text-smoke sm:inline">{cat?.name.split(" ")[0]}</span>
            </div>
            <h3 className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-tight text-white transition-colors group-hover:text-gold-soft sm:text-[0.95rem]">
              {product.name}
            </h3>
            <p className="mt-1 text-xs text-smoke">
              {product.variants.length > 1 ? `${product.variants.length} sizes · from ${v.label}` : v.label}
            </p>
            <div className="mt-auto flex items-end justify-between gap-2 pt-3">
              <div className="leading-none">
                <div className="text-lg font-extrabold text-white sm:text-xl">{inr(v.price)}</div>
                {off > 0 && <div className="mt-1 text-xs text-smoke line-through">MRP {inr(v.mrp)}</div>}
              </div>
              {lowStock && <span className="text-[0.65rem] font-bold uppercase text-ember">Only {v.stock} left</span>}
            </div>
          </div>
        </Link>
        {available && <QuickAdd product={product} variant={v} />}
      </Tilt>
    </div>
  );
}
