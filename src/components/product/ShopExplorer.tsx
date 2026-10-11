"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { categories, categoryUrl, defaultVariant, inStock, minPrice } from "@/lib/catalog";
import { cn, discountPercent } from "@/lib/format";
import type { Product } from "@/types";
import { CloseIcon, FilterIcon, SearchIcon } from "../ui/Icons";
import { ProductCard } from "./ProductCard";

type Sort = "popular" | "price-asc" | "price-desc" | "discount" | "name";

export function ShopExplorer({ products, activeCategory }: { products: Product[]; activeCategory?: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [sort, setSort] = useState<Sort>((params.get("sort") as Sort) || "popular");
  const [brands, setBrands] = useState<string[]>([]);
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Header search navigates here with ?q= — keep the box in sync.
  const urlQ = params.get("q") ?? "";
  useEffect(() => setQ(urlQ), [urlQ]);

  const scoped = useMemo(() => (activeCategory ? products.filter((p) => p.category === activeCategory) : products), [products, activeCategory]);
  const brandOptions = useMemo(() => [...new Set(scoped.map((p) => p.brand))].sort(), [scoped]);

  const list = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    let out = scoped.filter((p) => {
      const hay = `${p.name} ${p.brand} ${p.category} ${p.variants.map((v) => v.label).join(" ")}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
    if (brands.length) out = out.filter((p) => brands.includes(p.brand));
    if (onlyInStock) out = out.filter(inStock);
    const byStock = (a: Product, b: Product) => Number(inStock(b)) - Number(inStock(a));
    const sorters: Record<Sort, (a: Product, b: Product) => number> = {
      popular: (a, b) => byStock(a, b) || Number(b.featured) - Number(a.featured) || a.sort - b.sort,
      "price-asc": (a, b) => minPrice(a) - minPrice(b),
      "price-desc": (a, b) => minPrice(b) - minPrice(a),
      discount: (a, b) => {
        const d = (p: Product) => {
          const v = defaultVariant(p);
          return discountPercent(v.price, v.mrp);
        };
        return d(b) - d(a);
      },
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return [...out].sort(sorters[sort]);
  }, [scoped, q, brands, onlyInStock, sort]);

  const updateUrl = (next: { q?: string; sort?: string }) => {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) (v ? sp.set(k, v) : sp.delete(k));
    router.replace(`${pathname}${sp.size ? `?${sp}` : ""}`, { scroll: false });
  };

  const toggleBrand = (b: string) => setBrands((prev) => (prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]));
  const activeFilters = brands.length + Number(onlyInStock);

  const filters = (
    <div className="space-y-7">
      <div>
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-smoke">Category</p>
        <div className="flex flex-col gap-1">
          <Link href="/shop" className={cn("rounded-xl px-3 py-2 text-sm transition", !activeCategory ? "bg-blood/15 font-bold text-white" : "text-zinc-400 hover:bg-white/5 hover:text-white")}>
            All products <span className="text-smoke">({products.length})</span>
          </Link>
          {categories.map((c) => {
            const n = products.filter((p) => p.category === c.slug).length;
            if (!n) return null;
            return (
              <Link
                key={c.slug}
                href={categoryUrl(c.slug)}
                className={cn("rounded-xl px-3 py-2 text-sm transition", activeCategory === c.slug ? "bg-blood/15 font-bold text-white" : "text-zinc-400 hover:bg-white/5 hover:text-white")}
              >
                {c.name} <span className="text-smoke">({n})</span>
              </Link>
            );
          })}
        </div>
      </div>
      <div>
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-smoke">Availability</p>
        <label className="flex cursor-pointer items-center gap-3 text-sm">
          <input type="checkbox" checked={onlyInStock} onChange={(e) => setOnlyInStock(e.target.checked)} className="h-4 w-4 accent-[#e10600]" />
          In stock only
        </label>
      </div>
      <div>
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-smoke">Brand</p>
        <div className="flex flex-wrap gap-2">
          {brandOptions.map((b) => (
            <button
              key={b}
              onClick={() => toggleBrand(b)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                brands.includes(b) ? "border-gold bg-gold text-black" : "border-white/10 text-zinc-300 hover:border-white/30",
              )}
            >
              {b}
            </button>
          ))}
        </div>
      </div>
      {activeFilters > 0 && (
        <button onClick={() => { setBrands([]); setOnlyInStock(false); }} className="text-xs font-bold uppercase tracking-widest text-ember">
          Clear filters
        </button>
      )}
    </div>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[15rem_1fr]">
      <aside className="hidden lg:block">
        <div className="sticky top-28">{filters}</div>
      </aside>

      <div className="min-w-0">
        {/* Phone/tablet: swipeable category chips */}
        <nav aria-label="Categories" className="no-scrollbar -mx-4 mb-4 flex snap-x gap-2 overflow-x-auto px-4 lg:hidden">
          {[{ slug: "", name: "All" }, ...categories.filter((c) => products.some((p) => p.category === c.slug))].map((c) => {
            const active = c.slug ? activeCategory === c.slug : !activeCategory;
            return (
              <Link
                key={c.slug || "all"}
                href={c.slug ? categoryUrl(c.slug) : "/shop"}
                scroll={false}
                className={cn(
                  "shrink-0 snap-start rounded-full border px-4 py-2 text-sm font-semibold transition",
                  active ? "border-transparent bg-blood text-white" : "border-white/10 bg-white/[0.03] text-zinc-300",
                )}
              >
                {c.name}
              </Link>
            );
          })}
        </nav>
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <label className="relative min-w-0 flex-1 basis-60">
            <span className="sr-only">Search</span>
            <SearchIcon size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-smoke" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onBlur={() => updateUrl({ q })}
              placeholder="Search by product, brand or size…"
              className="input rounded-full! pl-11"
            />
          </label>
          <button onClick={() => setFiltersOpen(true)} className="btn btn-ghost rounded-full! py-3! lg:hidden">
            <FilterIcon size={16} /> Filters {activeFilters > 0 && <span className="rounded-full bg-gold px-1.5 text-black">{activeFilters}</span>}
          </button>
          <label className="flex items-center gap-2 text-sm text-smoke">
            <span className="hidden sm:inline">Sort</span>
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as Sort);
                updateUrl({ sort: e.target.value === "popular" ? "" : e.target.value });
              }}
              className="input w-auto! rounded-full! py-2.5! pr-8"
            >
              <option value="popular">Popular</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
              <option value="discount">Biggest discount</option>
              <option value="name">Name A–Z</option>
            </select>
          </label>
        </div>

        <p className="mb-4 text-sm text-smoke">
          Showing <b className="text-white">{list.length}</b> product{list.length === 1 ? "" : "s"}
          {q && (
            <>
              {" "}for “<span className="text-gold">{q}</span>”
              <button onClick={() => { setQ(""); updateUrl({ q: "" }); }} className="ml-2 text-xs underline">clear</button>
            </>
          )}
        </p>

        {list.length ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
            {list.map((p, i) => (
              <ProductCard key={p.slug} product={p} priority={i < 4} delay={(i % 4) * 60} />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-white/10 p-12 text-center">
            <p className="font-display text-3xl">No products found</p>
            <p className="mt-2 text-sm text-smoke">Try a different search, or ask us on WhatsApp — we can source it for you.</p>
          </div>
        )}
      </div>

      {/* Mobile filters sheet */}
      <div className={cn("fixed inset-0 z-50 lg:hidden", filtersOpen ? "visible" : "invisible")}>
        <div className={cn("absolute inset-0 bg-black/70 transition-opacity", filtersOpen ? "opacity-100" : "opacity-0")} onClick={() => setFiltersOpen(false)} />
        <div className={cn("absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl border-t border-white/10 bg-coal p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] transition-transform duration-300", filtersOpen ? "translate-y-0" : "translate-y-full")}>
          <div className="mb-6 flex items-center justify-between">
            <p className="font-display text-2xl">Filters</p>
            <button onClick={() => setFiltersOpen(false)} aria-label="Close filters" className="p-2">
              <CloseIcon />
            </button>
          </div>
          {filters}
          <button onClick={() => setFiltersOpen(false)} className="btn btn-red mt-8 w-full">
            Show {list.length} products
          </button>
        </div>
      </div>
    </div>
  );
}
