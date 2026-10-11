import type { Metadata } from "next";
import { ProteinCalculator } from "@/components/tools/ProteinCalculator";
import { PageHero } from "@/components/ui/PageHero";

export const metadata: Metadata = {
  title: "Protein Calculator — How Much Protein Do I Need?",
  description: "Free protein calculator: find your daily protein target for muscle gain, fat loss or fitness, per meal, with whey scoops and Indian food examples.",
  alternates: { canonical: "/protein-calculator" },
};

export default function ProteinCalculatorPage() {
  return (
    <>
      <PageHero
        title="Protein"
        highlight="calculator"
        subtitle="How much protein do you really need? Pick your goal — get your daily target, per-meal split and easy food examples."
        crumbs={[{ label: "Protein calculator" }]}
      />
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <ProteinCalculator />
      </div>
    </>
  );
}
