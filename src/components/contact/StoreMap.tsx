import { siteConfig } from "@/config/site";
import { cn } from "@/lib/format";
import { ArrowRight, PinIcon, StarIcon } from "../ui/Icons";
import { ShopStatus } from "../ui/ShopStatus";

/** Google map of the shop (exact pin from the Google Business listing) + directions. */
export function StoreMap({ className }: { className?: string }) {
  const { contact } = siteConfig;
  const { address, googleRating } = contact;
  return (
    <div className={cn("flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-steel to-coal", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 p-5 sm:p-6">
        <div className="flex gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blood to-[#7a0300] text-snow shadow-lg shadow-blood/30">
            <PinIcon size={22} />
          </span>
          <div>
            <h2 className="font-display text-2xl leading-tight">Visit PowerX Nutrition</h2>
            <p className="mt-1 text-sm text-zinc-300">
              {address.line1}, {address.line2}, {address.district} Dist, {address.state} – {address.pincode}
            </p>
            <a href={contact.mapsUrl} target="_blank" rel="noopener" className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-semibold hover:text-gold">
              <span className="flex text-gold" aria-hidden>
                {Array.from({ length: 5 }, (_, i) => (
                  <StarIcon key={i} size={14} className={i < Math.round(googleRating.value) ? "" : "opacity-25"} />
                ))}
              </span>
              {googleRating.value} on Google · {googleRating.count} reviews
            </a>
          </div>
        </div>
        <div className="text-xs">
          <p className="font-semibold text-smoke">{contact.hours}</p>
          <ShopStatus className="mt-1.5 flex flex-wrap" />
        </div>
      </div>

      <div className="relative min-h-[20rem] flex-1 border-y border-white/8 bg-[#e5e3df]">
        <iframe
          title="PowerX Nutrition on Google Maps"
          src={contact.mapEmbedUrl}
          className="absolute inset-0 h-full w-full"
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>

      <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
        <a href={contact.directionsUrl} target="_blank" rel="noopener" className="btn btn-red shine">
          Get directions <ArrowRight size={16} />
        </a>
        <a href={contact.mapsUrl} target="_blank" rel="noopener" className="btn btn-ghost">
          Open in Google Maps
        </a>
      </div>
    </div>
  );
}
