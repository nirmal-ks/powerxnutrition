import { siteConfig } from "@/config/site";
import { inr } from "@/lib/format";

export function AnnouncementBar() {
  const msgs = [
    `FREE delivery on orders above ${inr(siteConfig.delivery.freeAbove)}`,
    "100% genuine products · Authorised brands",
    `Cash on Delivery within ${siteConfig.delivery.codRadiusKm} km of our shop`,
    "Track your order any time — no login",
    "Pay instantly with any UPI app",
    "Order on WhatsApp in one tap",
  ];
  const row = [...msgs, ...msgs];
  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-blood via-[#b30500] to-blood py-2 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-snow">
      <div className="animate-marquee flex w-max whitespace-nowrap">
        {row.map((m, i) => (
          <span key={i} className="flex items-center gap-10 pr-10">
            {m}
            <span className="text-gold">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
