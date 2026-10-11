import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ShopExplorer } from "@/components/product/ShopExplorer";
import { PageHero } from "@/components/ui/PageHero";
import { categories, categoryBySlug } from "@/lib/catalog";
import { getCatalog } from "@/lib/store";

export const revalidate = 300;
export const dynamicParams = false;

export function generateStaticParams() {
  return categories.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const cat = categoryBySlug((await params).category);
  if (!cat) return {};
  return {
    title: `Buy ${cat.name} Online — Best Price, 100% Genuine`,
    description: `Shop genuine ${cat.name.toLowerCase()} at PowerX Nutrition. ${cat.benefits.join(", ")}. Cash on Delivery & UPI. Fast delivery across India.`,
    alternates: { canonical: `/shop/${cat.slug}` },
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const cat = categoryBySlug((await params).category);
  if (!cat) notFound();
  const products = await getCatalog();
  return (
    <>
      <PageHero
        title={cat.name}
        subtitle={`${cat.tamil} · ${cat.benefits.join(" · ")}. Best taken: ${cat.when.toLowerCase()}.`}
        crumbs={[{ href: "/shop", label: "Shop" }, { label: cat.name }]}
      />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <Suspense>
          <ShopExplorer products={products} activeCategory={cat.slug} />
        </Suspense>
      </div>
    </>
  );
}
