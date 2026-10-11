import Link from "next/link";
import { whatsappLink } from "@/lib/whatsapp";
import { HeroCarousel, type HeroSlide } from "./HeroCarousel";
import { Counter } from "../ui/Counter";
import { ArrowRight, ShieldIcon, WhatsAppIcon } from "../ui/Icons";

export function Hero({ slides, productCount, brandCount }: { slides: HeroSlide[]; productCount: number; brandCount: number }) {
  return (
    <section className="relative isolate overflow-hidden">
      {/* Background layers */}
      <div className="bg-grid absolute inset-0 -z-10" />
      <div className="absolute -left-40 top-10 -z-10 h-[32rem] w-[32rem] rounded-full bg-[var(--glow)] blur-[120px]" />
      <div className="absolute -right-20 bottom-0 -z-10 h-[26rem] w-[26rem] rounded-full bg-gold/15 blur-[120px]" />
      <div className="font-display pointer-events-none absolute -bottom-8 left-1/2 -z-10 -translate-x-1/2 whitespace-nowrap text-[22vw] leading-none text-white/[0.025] select-none">
        POWERX
      </div>

      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-16 pt-8 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pb-24 lg:pt-14">
        {/* Copy */}
        <div className="relative z-10">
          <span className="animate-fade-up chip border border-gold/30 bg-gold/10 text-gold">
            <ShieldIcon size={14} /> 100% Genuine · Wholesale & Retail
          </span>
          <h1 className="font-display mt-5 text-[3.4rem] leading-[0.88] sm:text-7xl lg:text-[6.2rem]">
            <span className="animate-fade-up block [animation-delay:80ms]">Fuel Your</span>
            <span className="animate-fade-up block text-gold-gradient [animation-delay:160ms]">Better</span>
            <span className="animate-fade-up block text-outline [animation-delay:240ms]">Tomorrow</span>
          </h1>
          <p className="animate-fade-up mt-6 max-w-lg text-base leading-relaxed text-zinc-300 [animation-delay:320ms] sm:text-lg">
            Premium whey protein, creatine, mass gainers & pre-workouts from the world&apos;s top brands —
            delivered fast with <b className="text-white">Cash on Delivery</b> and <b className="text-white">instant UPI</b>.
          </p>
          <div className="animate-fade-up mt-8 flex flex-wrap gap-3 [animation-delay:400ms]">
            <Link href="/shop" className="btn btn-red shine">
              Shop Now <ArrowRight size={18} />
            </Link>
            <a href={whatsappLink("Hi PowerX Nutrition! I'd like to order supplements.")} target="_blank" rel="noopener" className="btn btn-ghost">
              <WhatsAppIcon size={18} className="text-[#25d366]" /> Order on WhatsApp
            </a>
          </div>
          <dl className="animate-fade-up mt-10 grid max-w-lg grid-cols-3 gap-3 [animation-delay:480ms]">
            {[
              { n: productCount, s: "+", label: "Products" },
              { n: brandCount, s: "+", label: "Top brands" },
              { n: 100, s: "%", label: "Genuine" },
            ].map((s) => (
              <div key={s.label} className="glass rounded-2xl px-3 py-3 text-center sm:px-4">
                <dt className="sr-only">{s.label}</dt>
                <dd className="font-display text-3xl text-white sm:text-4xl">
                  <Counter to={s.n} suffix={s.s} />
                </dd>
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-smoke">{s.label}</p>
              </div>
            ))}
          </dl>
        </div>

        {/* Product stage */}
        <div className="relative mx-auto mb-36 aspect-square w-full max-w-[34rem] sm:mb-32">
          <div className="absolute inset-[8%] rounded-full border border-gold/20" />
          <div className="animate-spin-slow absolute inset-[2%] rounded-full border border-dashed border-white/10" />
          <svg viewBox="0 0 200 200" className="animate-spin-slow absolute inset-0 h-full w-full [animation-duration:28s]" aria-hidden>
            <defs>
              <path id="ring" d="M100,100 m-84,0 a84,84 0 1,1 168,0 a84,84 0 1,1 -168,0" />
            </defs>
            <text className="fill-gold/70 text-[7.2px] font-bold tracking-[0.35em] uppercase">
              <textPath href="#ring">Genuine • Strength • Power • Recovery • Discipline • PowerX Nutrition •</textPath>
            </text>
          </svg>
          <HeroCarousel slides={slides} />

          {/* Badges sit in the empty corners, clear of the rotating text ring */}
          <div className="glass absolute right-0 top-0 z-30 hidden rounded-2xl px-3.5 py-2.5 text-right shadow-xl sm:block">
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-smoke">Delivery</p>
            <p className="font-display text-lg leading-tight text-white">Pan India</p>
          </div>
          <div className="glass absolute left-0 top-0 z-30 hidden rounded-2xl px-3.5 py-2.5 shadow-xl sm:block">
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-smoke">Pay by</p>
            <p className="font-display text-lg leading-tight text-gold">COD · UPI</p>
          </div>
        </div>
      </div>
    </section>
  );
}
