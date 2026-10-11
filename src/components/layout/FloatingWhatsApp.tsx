"use client";

import { usePathname } from "next/navigation";
import { whatsappLink } from "@/lib/whatsapp";
import { WhatsAppIcon } from "../ui/Icons";

export function FloatingWhatsApp() {
  const pathname = usePathname();
  if (pathname.startsWith("/admin") || pathname.startsWith("/checkout")) return null;
  // The cart has its own sticky checkout bar on phones — keep the button out of its way.
  const hideOnPhone = pathname.startsWith("/cart");
  return (
    <a
      href={whatsappLink("Hi PowerX Nutrition! I'd like to place an order / ask about a product.")}
      target="_blank"
      rel="noopener"
      aria-label="Order on WhatsApp"
      className={`${hideOnPhone ? "max-md:hidden " : ""}group fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-30 flex items-center gap-2 rounded-full bg-[#25d366] p-3 text-snow shadow-2xl shadow-black/50 animate-pulse-ring md:bottom-7 md:right-7 md:p-3.5`}
    >
      <WhatsAppIcon size={26} />
      <span className="max-w-0 overflow-hidden whitespace-nowrap text-sm font-bold transition-all duration-300 group-hover:max-w-40 group-hover:pr-1">
        Order on WhatsApp
      </span>
    </a>
  );
}
