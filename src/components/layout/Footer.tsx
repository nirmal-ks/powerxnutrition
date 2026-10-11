import Link from "next/link";
import { siteConfig } from "@/config/site";
import { categories, categoryUrl } from "@/lib/catalog";
import { whatsappLink } from "@/lib/whatsapp";
import { ClockIcon, InstagramIcon, MailIcon, PhoneIcon, PinIcon, WhatsAppIcon, YoutubeIcon } from "../ui/Icons";
import { Logo } from "../ui/Logo";
import { ShopStatus } from "../ui/ShopStatus";

export function Footer() {
  const { contact } = siteConfig;
  return (
    <footer className="theme-dark relative mt-24 overflow-hidden border-t border-white/8 bg-coal">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[60rem] -translate-x-1/2 rounded-full bg-blood/10 blur-3xl" />
      <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.3fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-smoke">
              100% genuine sports nutrition from the brands you trust. Wholesale & retail. {siteConfig.tagline}.
            </p>
            <div className="mt-5 flex gap-2">
              <a href={whatsappLink("Hi PowerX Nutrition!")} target="_blank" rel="noopener" aria-label="WhatsApp" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 transition hover:bg-[#25d366] hover:text-snow">
                <WhatsAppIcon size={18} />
              </a>
              <a href={siteConfig.social.instagram} target="_blank" rel="noopener" aria-label="Instagram" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 transition hover:bg-gradient-to-br hover:from-fuchsia-600 hover:to-orange-500">
                <InstagramIcon size={18} />
              </a>
              <a href={siteConfig.social.youtube} target="_blank" rel="noopener" aria-label="YouTube" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 transition hover:bg-red-600">
                <YoutubeIcon size={18} />
              </a>
            </div>
          </div>

          <div>
            <h3 className="font-display text-lg text-white">Shop</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-smoke">
              {categories.slice(0, 7).map((c) => (
                <li key={c.slug}>
                  <Link href={categoryUrl(c.slug)} className="transition hover:text-gold">{c.name}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-display text-lg text-white">Help</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-smoke">
              {[
                ["/track-order", "Track Your Order"],
                ["/faq", "FAQ"],
                ["/protein-calculator", "Protein Calculator"],
                ["/about", "About Us"],
                ["/contact", "Contact Us"],
                ["/shipping-policy", "Shipping Policy"],
                ["/refund-policy", "Refund & Returns"],
                ["/privacy-policy", "Privacy Policy"],
                ["/terms-and-conditions", "Terms & Conditions"],
              ].map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="transition hover:text-gold">{label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-display text-lg text-white">Visit / Call</h3>
            <ul className="mt-4 space-y-3 text-sm text-smoke">
              <li className="flex gap-3">
                <PinIcon size={18} className="mt-0.5 shrink-0 text-gold" />
                <a href={contact.mapsUrl} target="_blank" rel="noopener" className="hover:text-white">
                  {contact.address.line1}, {contact.address.line2}, {contact.address.district} Dist – {contact.address.pincode}
                </a>
              </li>
              <li className="flex gap-3">
                <PhoneIcon size={18} className="mt-0.5 shrink-0 text-gold" />
                <span>
                  <a href={`tel:+91${contact.phone}`} className="hover:text-white">{contact.phone}</a>
                  {" · "}
                  <a href={`tel:+91${contact.phone2}`} className="hover:text-white">{contact.phone2}</a>
                </span>
              </li>
              <li className="flex gap-3">
                <MailIcon size={18} className="mt-0.5 shrink-0 text-gold" />
                <a href={`mailto:${contact.email}`} className="break-all hover:text-white">{contact.email}</a>
              </li>
              <li className="flex gap-3">
                <ClockIcon size={18} className="mt-0.5 shrink-0 text-gold" />
                <span>
                  {contact.hours}
                  <ShopStatus className="mt-1 flex" />
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/8 pt-6 text-xs text-smoke sm:flex-row">
          <p>
            © {new Date().getFullYear()} {siteConfig.name}. All rights reserved. ·{" "}
            <a href="/?intro=1" className="hover:text-gold">
              ▶ Watch intro
            </a>
          </p>
          <p className="text-center">Supplements are a support, not a substitute for a healthy diet. Train hard · Live healthier.</p>
          <div className="flex items-center gap-2">
            {["COD", "UPI", "GPay", "PhonePe", "Paytm"].map((p) => (
              <span key={p} className="rounded-md border border-white/10 px-2 py-1 text-[0.65rem] font-bold text-zinc-300">{p}</span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
