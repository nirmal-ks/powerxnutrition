import type { Metadata } from "next";
import { LegalPage } from "@/components/ui/LegalPage";
import { siteConfig } from "@/config/site";
import { inr } from "@/lib/format";

export const metadata: Metadata = { title: "Shipping Policy", alternates: { canonical: "/shipping-policy" } };

export default function ShippingPage() {
  const { delivery, contact } = siteConfig;
  return (
    <LegalPage title="Shipping" highlight="Policy" updated="27 September 2026">
      <h2>Delivery areas</h2>
      <p>We deliver across India. Local delivery is available around {contact.address.city}, {contact.address.district} and nearby areas.</p>
      <p>
        Cash on Delivery is available only within {delivery.codRadiusKm} km of our shop (checked with your location at checkout). All other orders are prepaid by UPI and
        are confirmed once we verify the payment.
      </p>
      <h2>Delivery charges</h2>
      <ul>
        <li>FREE delivery on orders of {inr(delivery.freeAbove)} and above.</li>
        <li>A flat delivery charge of {inr(delivery.charge)} applies to orders below {inr(delivery.freeAbove)}.</li>
        <li>Remote pincodes may need extra time; we will tell you before dispatch if any extra charge applies.</li>
      </ul>
      <h2>Dispatch & delivery time</h2>
      <ul>
        <li>Orders are usually dispatched within 24 hours after confirmation (excluding Sundays and holidays).</li>
        <li>Local (Tiruvallur area): same or next day.</li>
        <li>Rest of Tamil Nadu: 2–4 business days. Other states: 3–7 business days.</li>
      </ul>
      <h2>Order tracking</h2>
      <p>We share the courier tracking details on WhatsApp / SMS once your order ships. Message us any time with your Order ID for an update.</p>
      <h2>Receiving your order</h2>
      <p>Please check that the outer package is sealed and undamaged before accepting. If it looks tampered with, refuse the delivery or record an unboxing video and contact us immediately.</p>
    </LegalPage>
  );
}
