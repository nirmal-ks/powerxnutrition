import { reviews } from "@/data/reviews";
import { StarIcon } from "../ui/Icons";

export function Reviews() {
  const row = [...reviews, ...reviews];
  return (
    <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]">
      <div className="animate-marquee flex w-max items-stretch hover:[animation-play-state:paused] [animation-duration:60s]">
        {row.map((r, i) => (
          <figure key={i} className="mr-4 flex w-[19rem] shrink-0 flex-col rounded-3xl border border-white/8 bg-gradient-to-b from-steel to-coal p-6 sm:w-[23rem]">
            <div className="flex gap-0.5 text-gold" aria-label={`${r.rating} out of 5 stars`}>
              {Array.from({ length: 5 }, (_, s) => (
                <StarIcon key={s} size={16} className={s < r.rating ? "" : "opacity-20"} />
              ))}
            </div>
            <blockquote className="mt-4 text-sm leading-relaxed text-zinc-300">“{r.text}”</blockquote>
            <figcaption className="mt-auto flex pt-5 items-center gap-3">
              <span className="font-display flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blood to-gold text-lg">
                {r.name[0]}
              </span>
              <span>
                <span className="block text-sm font-bold">{r.name}</span>
                <span className="block text-xs text-smoke">
                  {r.city} · bought {r.product}
                </span>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
