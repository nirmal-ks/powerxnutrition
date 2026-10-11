import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/seo/JsonLd";
import { WhatsAppIcon } from "@/components/ui/Icons";
import { PageHero } from "@/components/ui/PageHero";
import { siteConfig } from "@/config/site";
import { inr } from "@/lib/format";
import { whatsappLink } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "FAQ — Orders, Payment, Delivery & Products",
  description: `Answers about ordering from ${siteConfig.name}: UPI payment, Cash on Delivery, delivery time, genuine products, returns and supplement use.`,
  alternates: { canonical: "/faq" },
};

type QA = { q: string; a: React.ReactNode; text: string };

const { delivery, contact, upi } = siteConfig;

/** `text` is the plain-text answer for Google's FAQ rich results. */
const SECTIONS: { title: string; items: QA[] }[] = [
  {
    title: "Orders & payment",
    items: [
      {
        q: "How do I place an order?",
        text: "Add products to your cart, go to checkout, fill in your delivery details and choose UPI or Cash on Delivery. You get an Order ID instantly. You can also order directly on WhatsApp.",
        a: (
          <>
            Add products to your cart, go to <Link href="/checkout">checkout</Link>, fill in your delivery details and choose UPI or Cash on Delivery. You get an Order ID
            instantly. Prefer chatting? <a href={whatsappLink("Hi! I'd like to place an order.")} target="_blank" rel="noopener">Order on WhatsApp</a>.
          </>
        ),
      },
      {
        q: "How does UPI payment work? When is my order confirmed?",
        text: `After placing the order you see a QR code for the exact amount. Pay with GPay, PhonePe, Paytm or any UPI app to ${upi.id}, then enter the 12-digit UTR / reference number. We verify the payment and your order is confirmed — the page turns to "Payment successful" automatically.`,
        a: (
          <>
            After placing the order you see a QR code for the exact amount. Pay with GPay, PhonePe, Paytm or any UPI app, then enter the 12-digit UTR / reference number
            shown in your UPI app. We verify the payment and your order is confirmed — the page switches to <b>“Payment successful”</b> automatically. You can also
            send the payment screenshot on WhatsApp.
          </>
        ),
      },
      {
        q: "Is Cash on Delivery available?",
        text: `Cash on Delivery is available only within ${delivery.codRadiusKm} km of our shop in ${contact.address.city}. At checkout we check your location to confirm. Everywhere else, please pay by UPI.`,
        a: (
          <>
            Cash on Delivery is available only within <b>{delivery.codRadiusKm} km of our shop</b> in {contact.address.city}. At checkout we ask for your location once to
            confirm this. Everywhere else, please pay by UPI.
          </>
        ),
      },
      {
        q: "Where do I find the UTR number?",
        text: "Open your UPI app, tap the payment in your history and look for 'UPI Ref No', 'UTR' or 'Transaction ID' — usually a 12-digit number.",
        a: <>Open your UPI app, tap the payment in your history and look for “UPI Ref No”, “UTR” or “Transaction ID” — usually a 12-digit number.</>,
      },
      {
        q: "How can I check my order status?",
        text: "Use the Track Order page with your Order ID and the mobile number you ordered with. We also message you on WhatsApp when the order is confirmed and shipped.",
        a: (
          <>
            Use the <Link href="/track-order">Track Order</Link> page with your Order ID and mobile number. We also message you on WhatsApp when the order is confirmed and
            shipped.
          </>
        ),
      },
      {
        q: "Is it safe? Do you store my card or bank details?",
        text: "Yes, it's safe. UPI payments happen inside your own UPI app — we never see your bank details, UPI PIN or OTP, and we will never ask for them.",
        a: <>Yes. UPI payments happen inside your own UPI app — we never see your bank details, UPI PIN or OTP, and we will <b>never</b> ask for them.</>,
      },
    ],
  },
  {
    title: "Delivery",
    items: [
      {
        q: "How much is delivery?",
        text: `Free delivery on orders of ${inr(delivery.freeAbove)} and above. Below that a flat ${inr(delivery.charge)} applies.`,
        a: (
          <>
            <b>Free delivery</b> on orders of {inr(delivery.freeAbove)} and above. Below that, a flat {inr(delivery.charge)} applies.
          </>
        ),
      },
      {
        q: "How long does delivery take?",
        text: "Same or next day around Tiruvallur. 2–4 business days in the rest of Tamil Nadu and 3–7 business days to other states.",
        a: (
          <>
            Same or next day around {contact.address.district}. 2–4 business days in the rest of Tamil Nadu and 3–7 business days to other states. See the{" "}
            <Link href="/shipping-policy">shipping policy</Link>.
          </>
        ),
      },
      {
        q: "Can I pick up from the shop?",
        text: `Yes! Visit us at ${contact.address.line1}, ${contact.address.line2}. Open ${contact.hours}.`,
        a: (
          <>
            Yes! Visit us at {contact.address.line1}, {contact.address.line2}. Open {contact.hours}. <Link href="/contact">Get directions</Link>.
          </>
        ),
      },
    ],
  },
  {
    title: "Products",
    items: [
      {
        q: "Are your products 100% genuine?",
        text: "Yes. We source from authorised brands and distributors, and every tub comes with its original seal. Most brands also print an authenticity code you can check on their website.",
        a: <>Yes. We source from authorised brands and distributors, and every tub comes with its original seal. Most brands also print an authenticity code you can check on their website.</>,
      },
      {
        q: "Which supplement should I start with?",
        text: "Most beginners start with whey protein after workouts and creatine daily. Try our protein calculator, or message us your goal and we'll suggest a plan.",
        a: (
          <>
            Most beginners start with <Link href="/shop/whey-protein">whey protein</Link> after workouts and <Link href="/shop/creatine">creatine</Link> daily. Try our{" "}
            <Link href="/protein-calculator">protein calculator</Link>, or message us your goal and we&apos;ll suggest a plan — free.
          </>
        ),
      },
      {
        q: "A product is out of stock. Can I still get it?",
        text: "Tap 'Notify me on WhatsApp' on the product page and we'll tell you as soon as it's back. We can often source it within a few days.",
        a: <>Tap “Notify me on WhatsApp” on the product page and we&apos;ll tell you as soon as it&apos;s back — we can often source it within a few days.</>,
      },
      {
        q: "Do you offer wholesale prices for gyms?",
        text: "Yes — gyms, trainers and resellers get special pricing. Message us on WhatsApp with what you need.",
        a: (
          <>
            Yes — gyms, trainers and resellers get special pricing.{" "}
            <a href={whatsappLink("Hi! I'd like wholesale pricing for my gym.")} target="_blank" rel="noopener">Message us on WhatsApp</a>.
          </>
        ),
      },
    ],
  },
  {
    title: "Returns & refunds",
    items: [
      {
        q: "What if my product arrives damaged or wrong?",
        text: "Contact us within 48 hours of delivery on WhatsApp with your Order ID and photos (an unboxing video helps). We'll replace it or refund you.",
        a: (
          <>
            Contact us within <b>48 hours</b> of delivery on WhatsApp with your Order ID and photos (an unboxing video helps). We&apos;ll replace it or refund you. See the{" "}
            <Link href="/refund-policy">refund policy</Link>.
          </>
        ),
      },
      {
        q: "Can I cancel my order?",
        text: "Yes, before it ships. Message us on WhatsApp with your Order ID. UPI payments are refunded to the same UPI ID.",
        a: <>Yes, before it ships — message us on WhatsApp with your Order ID. UPI payments are refunded to the same UPI ID.</>,
      },
    ],
  },
];

export default function FaqPage() {
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: SECTIONS.flatMap((s) => s.items).map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.text } })),
  };

  return (
    <>
      <JsonLd data={faqLd} />
      <PageHero title="Frequently asked" highlight="questions" subtitle="Payment, delivery, genuine products and returns — everything in one place." crumbs={[{ label: "FAQ" }]} />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[14rem_1fr]">
        <nav className="hidden lg:block" aria-label="FAQ sections">
          <ul className="sticky top-28 space-y-1 text-sm">
            {SECTIONS.map((s) => (
              <li key={s.title}>
                <a href={`#${s.title.replace(/\W+/g, "-").toLowerCase()}`} className="block rounded-xl px-3 py-2 text-zinc-300 transition hover:bg-white/5 hover:text-gold">
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="space-y-10">
          {SECTIONS.map((s) => (
            <section key={s.title} id={s.title.replace(/\W+/g, "-").toLowerCase()} className="scroll-mt-28">
              <h2 className="font-display text-3xl">{s.title}</h2>
              <div className="mt-4 space-y-3">
                {s.items.map((i) => (
                  <details key={i.q} className="faq group rounded-2xl border border-white/8 bg-gradient-to-b from-steel to-coal open:border-gold/30">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 font-semibold">
                      {i.q}
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/15 text-gold transition-transform group-open:rotate-45" aria-hidden>
                        +
                      </span>
                    </summary>
                    <div className="faq-answer px-5 pb-5 leading-relaxed text-zinc-300">{i.a}</div>
                  </details>
                ))}
              </div>
            </section>
          ))}
          <div className="rounded-3xl border border-[#25d366]/30 bg-[#25d366]/[0.06] p-6 text-center">
            <p className="font-display text-2xl">Still have a question?</p>
            <p className="mt-1 text-sm text-smoke">We usually reply within minutes during shop hours.</p>
            <a href={whatsappLink(`Hi ${siteConfig.name}, I have a question.`)} target="_blank" rel="noopener" className="btn btn-whatsapp mt-4">
              <WhatsAppIcon size={18} /> Ask on WhatsApp
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
