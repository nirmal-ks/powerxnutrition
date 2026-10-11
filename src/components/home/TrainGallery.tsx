import Image from "@/components/ui/Img";
import Link from "next/link";
import { categoryUrl } from "@/lib/catalog";
import { cn } from "@/lib/format";
import type { CategorySlug } from "@/types";
import { ArrowRight } from "../ui/Icons";

const TILES: { img: string; title: string; text: string; cat: CategorySlug; span: string }[] = [
  { img: "/lifestyle/train-deadlift.jpg", title: "Get Stronger", text: "Creatine for raw power", cat: "creatine", span: "col-span-2 row-span-2" },
  { img: "/lifestyle/train-dumbbell.jpg", title: "Build Muscle", text: "Whey protein for growth", cat: "whey-protein", span: "col-span-1" },
  { img: "/lifestyle/train-shake.jpg", title: "Recover Faster", text: "BCAA, EAA & glutamine", cat: "amino-acids", span: "col-span-1" },
  { img: "/lifestyle/train-woman.jpg", title: "Stay Lean", text: "Fat burners & L-carnitine", cat: "fat-burners", span: "col-span-1" },
  { img: "/lifestyle/train-running.jpg", title: "Train Harder", text: "Pre-workout energy", cat: "pre-workout", span: "col-span-1" },
];

/** Lifestyle photo grid — each tile links to the matching category. */
export function TrainGallery() {
  return (
    <div className="grid auto-rows-[10rem] grid-cols-2 gap-3 sm:auto-rows-[14rem] sm:gap-4 lg:grid-cols-4">
      {TILES.map((t, i) => (
        <Link
          key={t.title}
          href={categoryUrl(t.cat)}
          data-reveal="zoom"
          style={{ "--delay": `${i * 80}ms` } as React.CSSProperties}
          className={cn("theme-dark group relative isolate overflow-hidden rounded-3xl border border-white/10 bg-coal", t.span)}
        >
          <Image
            src={t.img}
            alt={`${t.title} — ${t.text}`}
            fill
            sizes={i === 0 ? "(max-width: 1024px) 100vw, 50vw" : "(max-width: 1024px) 50vw, 25vw"}
            className="-z-10 object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-110"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
          <div className="absolute inset-0 -z-10 bg-blood/0 mix-blend-multiply transition-colors duration-500 group-hover:bg-blood/35" />
          <div className="flex h-full flex-col justify-end p-4 sm:p-6">
            <h3 className={cn("font-display leading-none text-white", i === 0 ? "text-4xl sm:text-6xl" : "text-2xl sm:text-3xl")}>{t.title}</h3>
            <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-white/80 sm:text-sm">
              {t.text}
              <ArrowRight size={14} className="-translate-x-1 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" />
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
