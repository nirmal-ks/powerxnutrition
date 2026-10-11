import Image from "@/components/ui/Img";
import { categoryBySlug } from "@/lib/catalog";
import { cn } from "@/lib/format";
import type { CategorySlug } from "@/types";

interface Props {
  src: string;
  alt: string;
  brand: string;
  category: CategorySlug;
  sizes?: string;
  priority?: boolean;
  className?: string;
}

/**
 * Product photo with a branded "tub" placeholder when no image is set yet,
 * so the shop always looks finished.
 */
export function ProductImage({ src, alt, brand, category, sizes = "(max-width: 640px) 50vw, 25vw", priority, className }: Props) {
  if (src) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className={cn("object-contain", className)}
      />
    );
  }
  const cat = categoryBySlug(category);
  return (
    <div className={cn("absolute inset-0 flex items-center justify-center", className)} role="img" aria-label={alt}>
      <div className="relative h-[78%] aspect-[3/4]">
        <div className="absolute inset-x-[8%] top-0 h-[14%] rounded-t-xl bg-gradient-to-b from-zinc-500 to-zinc-800" />
        <div className={cn("absolute inset-x-0 bottom-0 top-[11%] overflow-hidden rounded-2xl bg-gradient-to-br shadow-2xl shadow-black/60", cat?.accent ?? "from-red-600 to-red-900")}>
          <div className="absolute inset-y-0 left-[12%] w-[14%] bg-snow/15 blur-sm" />
          <div className="absolute inset-x-0 top-[30%] flex flex-col items-center gap-1 px-2 text-center">
            <span className="text-[0.55rem] font-bold tracking-[0.25em] text-snow/80 uppercase">{brand}</span>
            <span className="font-display text-lg leading-none text-snow">{cat?.name.split(" ")[0] ?? "Supplement"}</span>
          </div>
          <div className="absolute inset-x-0 bottom-[10%] text-center font-display text-[0.6rem] tracking-widest text-gold">POWERX</div>
        </div>
      </div>
    </div>
  );
}
