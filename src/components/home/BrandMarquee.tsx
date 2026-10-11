export function BrandMarquee({ brands }: { brands: string[] }) {
  // Two identical halves → translateX(-50%) loops seamlessly
  const half = (key: string) => (
    <ul key={key} className="flex shrink-0 items-center" aria-hidden={key === "b"}>
      {brands.map((b, i) => (
        <li key={b} className="flex items-center">
          <span className={`font-display whitespace-nowrap px-8 text-2xl leading-none sm:px-10 sm:text-4xl ${i % 2 ? "text-outline" : "text-white/90"}`}>
            {b}
          </span>
          <span className="text-lg leading-none text-blood sm:text-2xl" aria-hidden>
            ✕
          </span>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="relative border-y border-white/8 bg-gradient-to-r from-coal via-steel to-coal py-5 sm:py-6">
      <div className="overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]">
        <div className="animate-marquee flex w-max items-center hover:[animation-play-state:paused] [animation-duration:50s]">
          {half("a")}
          {half("b")}
        </div>
      </div>
    </div>
  );
}
