import type { Metadata } from "next";
import { LegalPage } from "@/components/ui/LegalPage";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: "Refund & Return Policy", alternates: { canonical: "/refund-policy" } };

export default function RefundPage() {
  const { contact } = siteConfig;
  return (
    <LegalPage title="Refund &" highlight="Return Policy" updated="27 September 2026">
      <p>Because supplements are consumable health products, we can only accept returns in the cases below. Your satisfaction matters to us — just reach out.</p>
      <h2>Eligible for return / replacement</h2>
      <ul>
        <li>Wrong product, size or flavour delivered.</li>
        <li>Product damaged or leaking on arrival.</li>
        <li>Seal broken or tampered with on arrival.</li>
        <li>Product expired on arrival.</li>
      </ul>
      <h2>How to request</h2>
      <ul>
        <li>Contact us within <b>48 hours</b> of delivery on WhatsApp ({contact.phone}) with your Order ID, photos and, ideally, an unboxing video.</li>
        <li>The product must be unused, with its original seal and packaging.</li>
        <li>After approval we arrange pickup or ask you to send it back; we cover return shipping for our mistakes.</li>
      </ul>
      <h2>Not eligible</h2>
      <ul>
        <li>Opened or used products (for hygiene and safety reasons).</li>
        <li>Change of mind, taste preference, or results not as expected.</li>
        <li>Requests made after 48 hours of delivery.</li>
      </ul>
      <h2>Refunds</h2>
      <ul>
        <li>Once the returned product is received and checked, we issue a replacement or refund within 5–7 business days.</li>
        <li>UPI payments are refunded to the same UPI ID. COD orders are refunded by UPI / bank transfer to details you share.</li>
      </ul>
      <h2>Cancellations</h2>
      <p>You can cancel any time before dispatch for a full refund. Once shipped, the order can be refused at the door; the delivery charge may be deducted for prepaid orders.</p>
    </LegalPage>
  );
}
