import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BuyBox } from "@/components/product/BuyBox";
import { ProductCard } from "@/components/product/ProductCard";
import { RecentlyViewed, ShareProduct } from "@/components/product/ProductExtras";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductReviews } from "@/components/product/ProductReviews";
import { Stars } from "@/components/ui/Stars";
import { getProductReviews } from "@/lib/reviews";
import { JsonLd } from "@/components/seo/JsonLd";
import { CheckIcon, ClockIcon, DumbbellIcon } from "@/components/ui/Icons";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { siteConfig } from "@/config/site";
import { categoryBySlug, categoryUrl, defaultVariant, productUrl } from "@/lib/catalog";
import { inr } from "@/lib/format";
import { getCatalog, getCatalogProduct } from "@/lib/store";

export const revalidate = 300;

export async function generateStaticParams() {
  return (await getCatalog()).map((p) => ({ slug: p.slug }));
}

type Props = { params: Promise<{ slug: string }> };

const absolute = (src: string) => (src.startsWith("http") ? src : `${siteConfig.url}${src}`);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getCatalogProduct((await params).slug);
  if (!product) return { title: "Product not found" };
  const v = defaultVariant(product);
  const title = `${product.name} (${product.variants.map((x) => x.label).join(", ")}) — Buy at ${inr(v.price)}`;
  const description = `${product.description.slice(0, 150)}… 100% genuine ${product.brand}. COD & UPI available.`;
  return {
    title,
    description,
    alternates: { canonical: productUrl(product.slug) },
    openGraph: {
      title,
      description,
      url: productUrl(product.slug),
      images: product.image ? [{ url: absolute(product.image), alt: product.name }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const product = await getCatalogProduct((await params).slug);
  if (!product) notFound();
  const cat = categoryBySlug(product.category);
  const related = (await getCatalog()).filter((p) => p.category === product.category && p.slug !== product.slug).slice(0, 4);
  const { reviews, summary } = await getProductReviews(product.slug);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    sku: product.slug,
    category: cat?.name,
    brand: { "@type": "Brand", name: product.brand },
    image: product.image ? [absolute(product.image)] : undefined,
    url: `${siteConfig.url}${productUrl(product.slug)}`,
    offers: product.variants.map((v) => ({
      "@type": "Offer",
      sku: `${product.slug}-${v.id}`,
      name: `${product.name} — ${v.label}`,
      price: v.price,
      priceCurrency: "INR",
      availability: v.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      url: `${siteConfig.url}${productUrl(product.slug)}`,
      seller: { "@type": "Organization", name: siteConfig.name },
    })),
    ...(summary.count
      ? {
          aggregateRating: { "@type": "AggregateRating", ratingValue: summary.average, reviewCount: summary.count, bestRating: 5, worstRating: 1 },
          review: reviews.slice(0, 5).map((r) => ({
            "@type": "Review",
            author: { "@type": "Person", name: r.name },
            datePublished: r.createdAt.slice(0, 10),
            reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5 },
            name: r.title,
            reviewBody: r.text,
          })),
        }
      : {}),
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
      { "@type": "ListItem", position: 2, name: "Shop", item: `${siteConfig.url}/shop` },
      ...(cat ? [{ "@type": "ListItem", position: 3, name: cat.name, item: `${siteConfig.url}${categoryUrl(cat.slug)}` }] : []),
      { "@type": "ListItem", position: cat ? 4 : 3, name: product.name },
    ],
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <JsonLd data={breadcrumbLd} />

      <div className="relative">
        <div className="bg-grid absolute inset-x-0 top-0 h-[40rem]" />
        <div className="relative mx-auto max-w-7xl px-4 pb-10 pt-6 sm:px-6 sm:pt-10">
          <nav aria-label="Breadcrumb" className="text-xs font-semibold uppercase tracking-widest text-smoke">
            <Link href="/" className="hover:text-white">Home</Link>
            <span className="mx-2 text-blood">/</span>
            <Link href="/shop" className="hover:text-white">Shop</Link>
            {cat && (
              <>
                <span className="mx-2 text-blood">/</span>
                <Link href={categoryUrl(cat.slug)} className="hover:text-white">{cat.name}</Link>
              </>
            )}
          </nav>

          <div className="mt-6 grid gap-10 lg:grid-cols-2 lg:gap-16">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <ProductGallery product={product} />
            </div>

            <div>
              <p className="animate-fade-up text-sm font-bold uppercase tracking-[0.25em] text-gold">{product.brand}</p>
              <h1 className="font-display animate-fade-up mt-2 text-4xl leading-[0.95] [animation-delay:60ms] sm:text-5xl">{product.name}</h1>
              <a href="#reviews" className="mt-3 inline-flex items-center gap-2 text-sm text-zinc-300 hover:text-gold">
                <Stars value={summary.average} size={16} />
                {summary.count ? (
                  <span>
                    <b className="text-white">{summary.average.toFixed(1)}</b> · {summary.count} review{summary.count > 1 ? "s" : ""}
                  </span>
                ) : (
                  <span className="underline underline-offset-2">Be the first to review</span>
                )}
              </a>
              {cat && (
                <Link href={categoryUrl(cat.slug)} className="chip mt-4 border border-white/10 bg-white/5 text-zinc-300 hover:border-gold/40">
                  {cat.name} · {cat.tamil}
                </Link>
              )}
              <div className="mt-8">
                <BuyBox product={product} />
              </div>
              <div className="mt-5">
                <ShareProduct name={product.name} slug={product.slug} />
              </div>

              <div className="mt-10 space-y-4">
                <div className="rounded-3xl border border-white/8 bg-white/[0.02] p-6">
                  <h2 className="font-display text-2xl">About this product</h2>
                  <p className="mt-3 whitespace-pre-line leading-relaxed text-zinc-300">{product.description}</p>
                  {cat && (
                    <ul className="mt-4 space-y-2">
                      {cat.benefits.map((b) => (
                        <li key={b} className="flex items-center gap-2 text-sm text-zinc-300">
                          <CheckIcon size={16} className="text-green-400" /> {b}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {cat && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-3xl border border-white/8 bg-gradient-to-br from-blood/15 to-transparent p-5">
                      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gold">
                        <ClockIcon size={16} /> When to take
                      </p>
                      <p className="mt-2 font-semibold">{cat.when}</p>
                    </div>
                    <div className="rounded-3xl border border-white/8 bg-gradient-to-br from-gold/10 to-transparent p-5">
                      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gold">
                        <DumbbellIcon size={16} /> How to take
                      </p>
                      <p className="mt-2 font-semibold">{cat.how}</p>
                    </div>
                  </div>
                )}
                <p className="text-xs leading-relaxed text-smoke">
                  Always follow the directions on the label. Consult a doctor before use if you are pregnant, nursing, under 18 or have a medical condition.
                  Product packaging and flavour may vary from the image.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ProductReviews slug={product.slug} productName={product.name} summary={summary} reviews={reviews} />

      {related.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6">
          <SectionHeading eyebrow="You may also like" title="More" highlight={cat?.name ?? "products"} />
          <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-4">
            {related.map((p, i) => (
              <ProductCard key={p.slug} product={p} delay={i * 70} />
            ))}
          </div>
        </section>
      )}

      <RecentlyViewed
        current={{ slug: product.slug, name: product.name, brand: product.brand, category: product.category, image: product.image, price: defaultVariant(product).price }}
      />
    </>
  );
}
