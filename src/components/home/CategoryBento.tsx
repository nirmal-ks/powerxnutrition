import Image from "@/components/ui/Img";
import Link from "next/link";
import { categoryBySlug, categoryUrl } from "@/lib/catalog";
import { cn } from "@/lib/format";
import type { CategorySlug, Product } from "@/types";
import { ArrowRight } from "../ui/Icons";

const TILES: { slug: CategorySlug; span: string }[] = [
  { slug: "whey-protein", span: "col-span-2 row-span-2" },
  { slug: "creatine", span: "col-span-1" },
  { slug: "mass-gainer", span: "col-span-1" },
  { slug: "pre-workout", span: "col-span-1" },
  { slug: "vitamins", span: "col-span-1" },
  { slug: "amino-acids", span: "col-span-1" },
  { slug: "fat-burners", span: "col-span-1" },
];

export function CategoryBento({ products, counts }: { products: Product[]; counts: Record<string, number> }) {
  const imageFor = (slug: CategorySlug) => products.find((p) => p.category === slug && p.image && p.featured)?.image ?? products.find((p) => p.category === slug && p.image)?.image;

  return (
    <div className="grid auto-rows-[11rem] grid-cols-2 gap-3 sm:auto-rows-[13rem] sm:gap-4 lg:grid-cols-4">
      {TILES.map(({ slug, span }, i) => {
        const cat = categoryBySlug(slug)!;
        const img = imageFor(slug);
        const big = i === 0;
        return (
          <Link
            key={slug}
            href={categoryUrl(slug)}
            data-reveal="zoom"
            style={{ "--delay": `${i * 70}ms` } as React.CSSProperties}
            className={cn(
              "theme-dark group relative isolate overflow-hidden rounded-3xl border border-white/8 bg-gradient-to-br p-4 sm:p-5",
              cat.accent,
              span,
            )}
          >
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.18),transparent_55%)]" />
            <div className="absolute inset-0 -z-10 bg-black/25 transition-colors duration-500 group-hover:bg-black/5" />
            {img && (
              <div
                className={cn(
                  "absolute -z-10 transition-transform duration-700 ease-out group-hover:-rotate-6 group-hover:scale-110",
                  big ? "-bottom-4 -right-4 h-[78%] w-[62%]" : "-bottom-3 -right-3 h-[70%] w-[55%]",
                )}
              >
                <div className="relative h-full w-full overflow-hidden rounded-[2rem] bg-snow/90 p-2 shadow-2xl shadow-black/50">
                  <Image src={img} alt="" fill sizes={big ? "40vw" : "20vw"} className="object-contain p-2 mix-blend-multiply" />
                </div>
              </div>
            )}
            <div className="flex h-full flex-col">
              <span className="text-xs font-semibold text-white/75">{cat.tamil}</span>
              <h3 className={cn("font-display mt-1 leading-[0.95] text-white drop-shadow", big ? "text-4xl sm:text-6xl" : "text-2xl sm:text-3xl")}>
                {cat.name}
              </h3>
              <p className="mt-1 text-xs font-semibold text-white/80 sm:text-sm">{cat.tagline}</p>
              <span className="mt-auto inline-flex w-fit items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-wider text-white backdrop-blur transition-all group-hover:bg-snow group-hover:text-black">
                {counts[slug] ?? 0} products <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          </Link>
        );
      })}
      <Link
        href="/shop"
        data-reveal="zoom"
        className="group col-span-2 flex items-center justify-between rounded-3xl border border-gold/30 bg-gold/5 p-5 transition-colors hover:bg-gold/15 lg:col-span-1"
      >
        <span className="font-display text-2xl leading-none sm:text-3xl">
          View all <span className="text-gold">categories</span>
        </span>
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gold text-black transition-transform group-hover:rotate-[-45deg]">
          <ArrowRight />
        </span>
      </Link>
    </div>
  );
}
