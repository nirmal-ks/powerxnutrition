import { siteConfig } from "@/config/site";
import { inr } from "@/lib/format";
import { DumbbellIcon, LockIcon, ShieldIcon, TruckIcon } from "../ui/Icons";

const ITEMS = [
  {
    icon: ShieldIcon,
    title: "Genuine Products",
    text: "Sourced from authorised distributors. Every pack is sealed with a scratch/verify code and fresh expiry.",
  },
  {
    icon: LockIcon,
    title: "Secure Payment",
    text: "Pay Cash on Delivery or instantly with GPay, PhonePe, Paytm or any UPI app. No card details stored.",
  },
  {
    icon: TruckIcon,
    title: "Fast Delivery",
    text: `Same/next-day around Tiruvallur, 2–5 days across India. FREE delivery above ${inr(siteConfig.delivery.freeAbove)}.`,
  },
  {
    icon: DumbbellIcon,
    title: "Expert Guidance",
    text: "Not sure what to take? Our team helps you pick the right supplement for your goal — just WhatsApp us.",
  },
];

export function WhyChoose() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {ITEMS.map(({ icon: Icon, title, text }, i) => (
        <div
          key={title}
          data-reveal
          style={{ "--delay": `${i * 90}ms` } as React.CSSProperties}
          className="group relative overflow-hidden rounded-3xl border border-white/8 bg-gradient-to-b from-steel to-coal p-6 transition-all duration-500 hover:-translate-y-1.5 hover:border-gold/40"
        >
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-blood/0 blur-2xl transition-colors duration-500 group-hover:bg-blood/30" />
          <span className="font-display absolute right-5 top-4 text-5xl text-white/5">0{i + 1}</span>
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blood to-[#7a0300] text-snow shadow-lg shadow-blood/30 transition-transform duration-500 group-hover:rotate-[-8deg] group-hover:scale-110">
            <Icon size={26} />
          </div>
          <h3 className="font-display relative mt-5 text-2xl">{title}</h3>
          <p className="relative mt-2 text-sm leading-relaxed text-smoke">{text}</p>
        </div>
      ))}
    </div>
  );
}
