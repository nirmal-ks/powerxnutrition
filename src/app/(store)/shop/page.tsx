import type { Metadata } from "next";
import { Suspense } from "react";
import { ShopExplorer } from "@/components/product/ShopExplorer";
import { PageHero } from "@/components/ui/PageHero";
import { getCatalog } from "@/lib/store";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Shop All Supplements — Whey Protein, Creatine, Mass Gainer",
  description:
    "Buy 100% genuine whey protein, creatine, mass gainers, pre-workouts, BCAA, fish oil and multivitamins online at PowerX Nutrition. COD & UPI available.",
  alternates: { canonical: "/shop" },
};

export default async function ShopPage() {
  const products = await getCatalog();
  return (
    <>
      <PageHero
        title="Shop"
        highlight="Supplements"
        subtitle="Genuine sports nutrition from ON, MuscleTech, MuscleBlaze, GNC, MAXN, Labrada, Cloud 9 & more."
        crumbs={[{ label: "Shop" }]}
      />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <Suspense>
          <ShopExplorer products={products} />
        </Suspense>
      </div>
    </>
  );
}
