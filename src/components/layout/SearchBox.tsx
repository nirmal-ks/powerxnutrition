"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { categories, categoryUrl, productUrl } from "@/lib/catalog";
import { cn, inr } from "@/lib/format";
import type { CategorySlug } from "@/types";
import { ProductImage } from "../product/ProductImage";
import { ArrowRight, SearchIcon } from "../ui/Icons";

export interface SearchItem {
  slug: string;
  name: string;
  brand: string;
  category: CategorySlug;
  image: string;
  price: number;
  inStock: boolean;
  featured: boolean;
  /** variant labels etc. — searched but not shown */
  keywords: string;
}

const MAX_PRODUCTS = 6;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9஀-௿]+/g, " ").trim();

function rank(items: SearchItem[], query: string) {
  const q = norm(query);
  const words = q.split(" ").filter(Boolean);
  if (!words.length) return [];
  const catName = (slug: string) => categories.find((c) => c.slug === slug)?.name ?? "";
  return items
    .map((item) => {
      const name = norm(item.name);
      const hay = `${name} ${norm(item.brand)} ${norm(catName(item.category))} ${item.category.replace(/-/g, " ")} ${norm(item.keywords)}`;
      if (!words.every((w) => hay.includes(w))) return null;
      let score = 0;
      if (name.startsWith(q)) score += 100;
      else if (name.split(" ").some((t) => t.startsWith(words[0]))) score += 50;
      if (name.includes(q)) score += 30;
      if (norm(item.brand).startsWith(words[0])) score += 20;
      if (item.inStock) score += 10;
      if (item.featured) score += 5;
      return { item, score };
    })
    .filter((r): r is { item: SearchItem; score: number } => r !== null)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.item);
}

/** Bolds the parts of `text` that match the typed words. */
function Highlight({ text, query }: { text: string; query: string }) {
  const words = norm(query).split(" ").filter(Boolean).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!words.length) return <>{text}</>;
  const parts = text.split(new RegExp(`(${words.join("|")})`, "gi"));
  return (
    <>
      {parts.map((p, i) => (i % 2 ? <mark key={i} className="bg-transparent font-extrabold text-gold">{p}</mark> : p))}
    </>
  );
}

/** Header search with instant suggestions (products + categories), keyboard navigable. */
export function SearchBox({ items, mobileOpen }: { items: SearchItem[]; mobileOpen: boolean }) {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    if (mobileOpen) inputRef.current?.focus();
  }, [mobileOpen]);

  const query = q.trim();
  const products = useMemo(
    () => (query ? rank(items, query) : items.filter((i) => i.featured && i.inStock)).slice(0, query ? MAX_PRODUCTS : 4),
    [items, query],
  );
  const totalMatches = useMemo(() => (query ? rank(items, query).length : 0), [items, query]);
  const cats = useMemo(() => {
    const words = norm(query).split(" ").filter(Boolean);
    if (!words.length) return categories.slice(0, 5);
    return categories
      .filter((c) => {
        const hay = norm(`${c.name} ${c.slug.replace(/-/g, " ")} ${c.tagline}`) + " " + c.tamil;
        return words.every((w) => hay.includes(w));
      })
      .slice(0, 3);
  }, [query]);

  // Flat list for arrow-key navigation: categories, products, then "see all".
  const options = useMemo(
    () => [
      ...cats.map((c) => ({ key: `c-${c.slug}`, href: categoryUrl(c.slug) })),
      ...products.map((p) => ({ key: `p-${p.slug}`, href: productUrl(p.slug) })),
      ...(query ? [{ key: "all", href: `/shop?q=${encodeURIComponent(query)}` }] : []),
    ],
    [cats, products, query],
  );

  useEffect(() => setActive(-1), [query]);

  const go = (href: string) => {
    setOpen(false);
    inputRef.current?.blur();
    router.push(href);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      const n = options.length;
      if (!n) return;
      setActive((i) => (e.key === "ArrowDown" ? (i + 1) % n : i <= 0 ? n - 1 : i - 1));
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (active >= 0 && options[active]) return go(options[active].href);
    go(`/shop?q=${encodeURIComponent(query)}`);
  };

  const optId = (key: string) => `${listId}-${key}`;
  const isActive = (key: string) => options[active]?.key === key;
  const showPanel = open && (query ? true : products.length > 0 || cats.length > 0);

  return (
    <form
      onSubmit={submit}
      className={cn(
        "absolute inset-x-0 top-full border-b border-white/8 bg-ink/95 p-3 backdrop-blur-xl transition-all md:static md:border-0 md:bg-transparent md:p-0 md:opacity-100 md:backdrop-blur-none",
        mobileOpen ? "visible opacity-100" : "invisible opacity-0 md:visible",
      )}
      role="search"
    >
      <div className="relative">
        <label className="relative block">
          <span className="sr-only">Search products</span>
          <SearchIcon size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-smoke" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={onKeyDown}
            placeholder="Search products…"
            role="combobox"
            aria-expanded={showPanel}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 && options[active] ? optId(options[active].key) : undefined}
            autoComplete="off"
            enterKeyHint="search"
            className="w-full rounded-full border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm outline-none transition-all placeholder:text-zinc-500 focus:border-gold/60 focus:bg-white/8 md:w-56 lg:w-64 md:focus:w-72"
          />
        </label>

        {showPanel && (
          <div
            id={listId}
            role="listbox"
            // Keep focus in the input while clicking a suggestion.
            onMouseDown={(e) => e.preventDefault()}
            className="absolute inset-x-0 top-full z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-2xl border border-white/10 bg-coal p-2 shadow-2xl shadow-black/60 md:left-auto md:w-[24rem]"
          >
            {cats.length > 0 && (
              <div className="px-2 pb-2 pt-1">
                <p className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-smoke">{query ? "Categories" : "Browse categories"}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {cats.map((c) => (
                    <Link
                      key={c.slug}
                      id={optId(`c-${c.slug}`)}
                      role="option"
                      aria-selected={isActive(`c-${c.slug}`)}
                      href={categoryUrl(c.slug)}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-semibold transition",
                        isActive(`c-${c.slug}`) ? "border-gold bg-gold/15 text-gold" : "border-white/10 text-zinc-300 hover:border-gold/50",
                      )}
                    >
                      <Highlight text={c.name} query={query} />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {products.length > 0 && (
              <>
                <p className="px-2 pt-1 text-[0.6rem] font-bold uppercase tracking-[0.2em] text-smoke">{query ? "Products" : "Popular right now"}</p>
                <ul className="mt-1">
                  {products.map((p) => (
                    <li key={p.slug}>
                      <Link
                        id={optId(`p-${p.slug}`)}
                        role="option"
                        aria-selected={isActive(`p-${p.slug}`)}
                        href={productUrl(p.slug)}
                        onClick={() => {
                          setOpen(false);
                          setQ("");
                        }}
                        className={cn("flex items-center gap-3 rounded-xl p-2 transition", isActive(`p-${p.slug}`) ? "bg-white/10" : "hover:bg-white/5")}
                      >
                        <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-gradient-to-b from-snow to-zinc-200">
                          <ProductImage src={p.image} alt="" brand={p.brand} category={p.category} sizes="44px" className="p-0.5 mix-blend-multiply" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">
                            <Highlight text={p.name} query={query} />
                          </span>
                          <span className="block text-xs text-smoke">
                            {p.brand}
                            {!p.inStock && <span className="ml-1.5 text-ember">· Out of stock</span>}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-bold text-gold">{inr(p.price)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {query && !products.length && !cats.length && (
              <p className="px-3 py-4 text-center text-sm text-smoke">
                No products match “<span className="text-white">{query}</span>”. Try another name or brand.
              </p>
            )}

            {query && (
              <Link
                id={optId("all")}
                role="option"
                aria-selected={isActive("all")}
                href={`/shop?q=${encodeURIComponent(query)}`}
                onClick={() => setOpen(false)}
                className={cn(
                  "mt-1 flex items-center justify-between rounded-xl border-t border-white/8 px-3 py-2.5 text-sm font-semibold transition",
                  isActive("all") ? "bg-white/10 text-gold" : "text-zinc-300 hover:text-gold",
                )}
              >
                {totalMatches ? `See all ${totalMatches} result${totalMatches === 1 ? "" : "s"} for “${query}”` : `Search the shop for “${query}”`}
                <ArrowRight size={16} />
              </Link>
            )}
          </div>
        )}
      </div>
    </form>
  );
}
