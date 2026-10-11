import Link from "next/link";
import { BrandMarquee } from "@/components/home/BrandMarquee";
import { CategoryBento } from "@/components/home/CategoryBento";
import { ContactSection } from "@/components/home/ContactSection";
import { FeaturedTabs } from "@/components/home/FeaturedTabs";
import { Hero } from "@/components/home/Hero";
import { Reviews } from "@/components/home/Reviews";
import { SupplementGuide } from "@/components/home/SupplementGuide";
import { TrainGallery } from "@/components/home/TrainGallery";
import Image from "@/components/ui/Img";
import { WhyChoose } from "@/components/home/WhyChoose";
import { ProductCard } from "@/components/product/ProductCard";
import { ArrowRight } from "@/components/ui/Icons";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { brandsOf, categoryBySlug, defaultVariant, inStock } from "@/lib/catalog";
import { getCatalog } from "@/lib/store";
import { siteConfig } from "@/config/site";

export const revalidate = 300;

const TAB_CATEGORIES: string[] = ["whey-protein", "creatine", "mass-gainer", "pre-workout", "vitamins"];
// Hero carousel: one star product per category (products without a photo are skipped)
const HERO_PICKS = [
  "on-gold-standard-whey",
  "muscleblaze-creatine",
  "maxn-mass-gainer",
  "cellucor-c4-original",
  "muscletech-nitrotech-whey",
  "scivation-xtend-bcaa",
  "on-opti-men",
  "nutrex-lipo-6",
  "c9-fish-oil",
];

export default async function HomePage() {
  const products = await getCatalog();
  const withImage = products.filter((p) => p.image);
  const picks = HERO_PICKS.map((s) => withImage.find((p) => p.slug === s)).filter((p) => p !== undefined);
  const heroProducts = picks.length >= 3 ? picks : withImage.filter((p) => p.featured).slice(0, 8);
  const slides = heroProducts.map((p) => {
    const v = defaultVariant(p);
    return { slug: p.slug, name: p.name, brand: p.brand, image: p.image, price: v.price, mrp: v.mrp, category: categoryBySlug(p.category)?.name ?? "" };
  });

  const counts = products.reduce<Record<string, number>>((acc, p) => ((acc[p.category] = (acc[p.category] ?? 0) + 1), acc), {});
  const brands = brandsOf(products).filter((b) => b !== "Assorted");

  // Tab candidates: in-stock featured products + the first 8 of each tab category (keeps the page light)
  const inStockList = products.filter((p) => inStock(p));
  const tabProducts = inStockList.filter(
    (p) =>
      p.featured ||
      (TAB_CATEGORIES.includes(p.category) && inStockList.filter((x) => x.category === p.category).indexOf(p) < 8),
  );
  const cards = Object.fromEntries(tabProducts.map((p) => [p.slug, <ProductCard key={p.slug} product={p} reveal={false} />]));

  return (
    <>
      <Hero slides={slides} productCount={Math.floor(products.length / 10) * 10} brandCount={Math.floor(brands.length / 5) * 5} />
      <BrandMarquee brands={brands} />

      <section className="mx-auto max-w-7xl px-4 pt-20 sm:px-6 sm:pt-28">
        <SectionHeading eyebrow="Shop by goal" title="Pick your" highlight="fuel" subtitle="Everything you need to build muscle, gain size, burn fat and recover faster.">
          <Link href="/shop" className="btn btn-ghost hidden sm:inline-flex">
            All products <ArrowRight size={16} />
          </Link>
        </SectionHeading>
        <CategoryBento products={products} counts={counts} />
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-20 sm:px-6 sm:pt-28">
        <SectionHeading eyebrow="Featured" title="Top" highlight="picks" subtitle="Our customers' favourites — genuine, fresh stock at the best prices." />
        <FeaturedTabs products={tabProducts} cards={cards} />
        <div className="mt-10 text-center">
          <Link href="/shop" className="btn btn-red shine">
            Explore all {products.length} products <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* Motivation banner */}
      <section className="theme-dark relative mt-24 overflow-hidden border-y border-white/8 bg-[linear-gradient(115deg,#140303_0%,#070707_45%,#171003_100%)] py-20 sm:py-32">
        <Image src="/lifestyle/banner-gym.jpg" alt="" fill sizes="100vw" className="object-cover opacity-45" />
        <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(40,3,2,0.85)_0%,rgba(7,7,7,0.55)_50%,rgba(30,20,2,0.85)_100%)]" />
        <div className="bg-grid absolute inset-0" />
        <div className="relative mx-auto flex max-w-7xl flex-col items-center px-4 text-center sm:px-6">
          <p data-reveal className="text-xs font-bold uppercase tracking-[0.4em] text-gold">Good nutrition · Better you</p>
          <h2 data-reveal className="font-display mt-4 text-5xl leading-[0.9] sm:text-7xl lg:text-8xl" style={{ "--delay": "80ms" } as React.CSSProperties}>
            Discipline <span className="text-outline">today</span>
            <br />
            <span className="text-fire-gradient">Stronger tomorrow</span>
          </h2>
          <p data-reveal className="mt-6 max-w-xl text-zinc-300" style={{ "--delay": "160ms" } as React.CSSProperties}>
            Supplements are a support, not a substitute. Pair the right fuel with hard training and clean food — we&apos;ll help you with the fuel.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-20 sm:px-6 sm:pt-28">
        <SectionHeading eyebrow="Train with PowerX" title="Your goal," highlight="our fuel" subtitle="Whatever you train for, we stock the supplements that get you there." />
        <TrainGallery />
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-20 sm:px-6 sm:pt-28">
        <SectionHeading eyebrow="Why PowerX" title="Why choose" highlight="PowerX Nutrition" align="center" />
        <WhyChoose />
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-20 sm:px-6 sm:pt-28">
        <SectionHeading
          eyebrow="Supplement guide"
          title="What it does &"
          highlight="when to take"
          subtitle="சரியான சப்ளிமெண்ட் · சரியான வாழ்க்கை! Quick guide to every supplement we sell."
        >
          <Link href="/protein-calculator" className="btn btn-ghost hidden sm:inline-flex">
            🧮 How much protein do I need? <ArrowRight size={16} />
          </Link>
        </SectionHeading>
        <SupplementGuide />
        <Link href="/protein-calculator" className="btn btn-ghost mt-6 w-full sm:hidden">
          🧮 How much protein do I need? <ArrowRight size={16} />
        </Link>
      </section>

      <section className="pt-20 sm:pt-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHeading eyebrow="Reviews" title="Trusted by" highlight="lifters" subtitle="Real results from the PowerX community.">
            <a
              href={siteConfig.contact.mapsUrl}
              target="_blank"
              rel="noopener"
              className="glass inline-flex items-center gap-3 self-start rounded-2xl px-4 py-3 transition hover:border-gold/40 sm:self-auto"
            >
              <span className="font-display text-3xl text-gold">{siteConfig.contact.googleRating.value}</span>
              <span className="text-left text-xs leading-tight">
                <span className="block font-bold">★★★★★ on Google</span>
                <span className="block text-smoke">{siteConfig.contact.googleRating.count} reviews · read them ↗</span>
              </span>
            </a>
          </SectionHeading>
        </div>
        <Reviews />
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-20 sm:px-6 sm:pt-28" id="contact">
        <ContactSection />
      </section>
    </>
  );
}
