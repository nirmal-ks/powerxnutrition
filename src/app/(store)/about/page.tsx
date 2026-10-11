import type { Metadata } from "next";
import Image from "@/components/ui/Img";
import Link from "next/link";
import { WhyChoose } from "@/components/home/WhyChoose";
import { ArrowRight } from "@/components/ui/Icons";
import { PageHero } from "@/components/ui/PageHero";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "About Us",
  description: `${siteConfig.name} is a wholesale & retail sports nutrition store in ${siteConfig.contact.address.district}, Tamil Nadu, selling 100% genuine supplements.`,
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <>
      <PageHero
        title="About"
        highlight="PowerX"
        subtitle="Good nutrition. Better you. We help everyday lifters, athletes and gym owners get genuine supplements at honest prices."
        crumbs={[{ label: "About Us" }]}
      />
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2">
        <div data-reveal="left" className="space-y-5 text-zinc-300">
          <h2 className="font-display text-4xl text-white sm:text-5xl">
            Discipline today. <span className="text-fire-gradient">Stronger tomorrow.</span>
          </h2>
          <p>
            PowerX Nutrition started with one simple idea: every person who trains hard deserves supplements they can trust. Fake and expired products
            are everywhere — so we source only from brands and authorised distributors, check every batch, and sell with fresh expiry dates.
          </p>
          <p>
            From our store on CTH Road, Veppampattu, we serve lifters across Tiruvallur, Chennai and the rest of India — with wholesale pricing for gyms and
            resellers, and personal guidance for beginners who don&apos;t know where to start.
          </p>
          <p>
            Whether your goal is muscle gain, weight gain, fat loss, strength or overall wellness, we&apos;ll help you pick the right product — and nothing you
            don&apos;t need.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/shop" className="btn btn-red shine">Shop now <ArrowRight size={18} /></Link>
            <Link href="/contact" className="btn btn-ghost">Visit the store</Link>
          </div>
        </div>
        <div data-reveal="right" className="relative">
          <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-blood/30 to-gold/20 blur-2xl" />
          <Image
            src="/brand/supplement-guide.jpg"
            alt="PowerX Nutrition supplement guide — what each supplement does, when to take it and how it helps"
            width={1024}
            height={1536}
            sizes="(max-width: 1024px) 90vw, 40vw"
            className="relative rounded-3xl border border-white/10 shadow-2xl"
          />
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading eyebrow="Our promise" title="What we" highlight="stand for" align="center" />
        <WhyChoose />
      </section>
    </>
  );
}
