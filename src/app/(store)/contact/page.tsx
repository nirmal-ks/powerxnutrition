import type { Metadata } from "next";
import { ContactForm } from "@/components/contact/ContactForm";
import { StoreMap } from "@/components/contact/StoreMap";
import { ContactSection } from "@/components/home/ContactSection";
import { PageHero } from "@/components/ui/PageHero";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Contact Us",
  description: `Call ${siteConfig.contact.phone} or WhatsApp PowerX Nutrition. Visit us at ${siteConfig.contact.address.line2}, ${siteConfig.contact.address.district} – ${siteConfig.contact.address.pincode}.`,
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <>
      <PageHero title="Contact" highlight="Us" subtitle="Questions about products, orders or wholesale? We usually reply on WhatsApp within minutes." crumbs={[{ label: "Contact" }]} />
      <div className="mx-auto max-w-7xl space-y-10 px-4 py-12 sm:px-6">
        <ContactSection />
        <div className="grid gap-8 lg:grid-cols-2">
          <div data-reveal className="rounded-3xl border border-white/8 bg-gradient-to-b from-steel to-coal p-6 sm:p-8">
            <h2 className="font-display text-3xl">Send us a message</h2>
            <p className="mb-6 mt-2 text-sm text-smoke">Your message opens in WhatsApp, ready to send.</p>
            <ContactForm />
          </div>
          <div data-reveal className="flex">
            <StoreMap className="w-full" />
          </div>
        </div>
      </div>
    </>
  );
}
