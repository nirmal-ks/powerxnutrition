import { siteConfig } from "@/config/site";
import { whatsappLink } from "@/lib/whatsapp";
import { ClockIcon, MailIcon, PhoneIcon, PinIcon, WhatsAppIcon } from "../ui/Icons";
import { ShopStatus } from "../ui/ShopStatus";

export function ContactSection() {
  const { contact } = siteConfig;
  const cards = [
    { icon: PinIcon, label: "Visit the store", value: `${contact.address.line1}, ${contact.address.line2}, ${contact.address.district} Dist – ${contact.address.pincode}`, href: contact.mapsUrl },
    { icon: PhoneIcon, label: "Call us", value: `${contact.phone} · ${contact.phone2}`, href: `tel:+91${contact.phone}` },
    { icon: MailIcon, label: "Email", value: contact.email, href: `mailto:${contact.email}` },
    { icon: ClockIcon, label: "Shop hours", value: contact.hours, live: true },
  ];
  return (
    <div className="theme-dark relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#1a0605] via-coal to-[#1a1402] p-6 sm:p-12">
      <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blood/25 blur-3xl" />
      <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-gold/15 blur-3xl" />
      <div className="relative grid items-center gap-10 lg:grid-cols-2">
        <div data-reveal="left">
          <span className="chip border border-[#25d366]/40 bg-[#25d366]/10 text-[#25d366]">
            <WhatsAppIcon size={14} /> Fastest way to order
          </span>
          <h2 className="font-display mt-4 text-4xl leading-[0.95] sm:text-6xl">
            Order in <span className="text-gold-gradient">one message</span>
          </h2>
          <p className="mt-4 max-w-md text-zinc-300">
            Tell us what you need on WhatsApp — we&apos;ll confirm stock, price and delivery in minutes. Wholesale enquiries welcome for gyms & resellers.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href={whatsappLink("Hi PowerX Nutrition! I'd like to place an order.")} target="_blank" rel="noopener" className="btn btn-whatsapp shine">
              <WhatsAppIcon size={20} /> Chat on WhatsApp
            </a>
            <a href={`tel:+91${contact.phone}`} className="btn btn-ghost">
              <PhoneIcon size={18} /> Call now
            </a>
          </div>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2" data-reveal="right">
          {cards.map(({ icon: Icon, label, value, href, live }) => {
            const inner = (
              <>
                <Icon size={22} className="text-gold" />
                <p className="mt-3 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-smoke">{label}</p>
                <p className="mt-1 text-sm font-semibold leading-snug break-words">{value}</p>
                {live && <ShopStatus className="mt-2 flex flex-wrap" />}
              </>
            );
            return (
              <li key={label}>
                {href ? (
                  <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener" className="glass block h-full rounded-2xl p-5 transition hover:border-gold/40">
                    {inner}
                  </a>
                ) : (
                  <div className="glass h-full rounded-2xl p-5">{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
