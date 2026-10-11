import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/ui/LegalPage";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: "Terms & Conditions", alternates: { canonical: "/terms-and-conditions" } };

export default function TermsPage() {
  return (
    <LegalPage title="Terms &" highlight="Conditions" updated="27 September 2026">
      <p>By using this website or placing an order with {siteConfig.name}, you agree to these terms.</p>
      <h2>Products</h2>
      <ul>
        <li>We sell genuine products sourced from brands and authorised distributors.</li>
        <li>Images are for illustration. Packaging, flavour and label design may vary from the photo.</li>
        <li>Dietary supplements are not medicines and are not meant to diagnose, treat, cure or prevent any disease. Follow the label directions and consult a doctor if you are pregnant, nursing, under 18 or have a medical condition.</li>
      </ul>
      <h2>Pricing & availability</h2>
      <ul>
        <li>All prices are in Indian Rupees (₹) and include applicable taxes unless stated otherwise.</li>
        <li>Prices and stock can change without notice. If an item becomes unavailable or a price was shown in error, we will contact you and you may cancel for a full refund of any amount paid.</li>
      </ul>
      <h2>Orders</h2>
      <ul>
        <li>An order is confirmed only after we verify it by phone or WhatsApp (and payment, for UPI orders).</li>
        <li>We may cancel orders that look fraudulent, have incomplete addresses, or cannot be delivered.</li>
      </ul>
      <h2>Payments</h2>
      <p>
        We accept UPI and, within {siteConfig.delivery.codRadiusKm} km of our shop, Cash on Delivery. For UPI, please share your transaction reference (UTR) or screenshot so we can
        match your payment — a UPI order is confirmed only after the payment is verified.
      </p>
      <h2>Shipping, returns & refunds</h2>
      <p>
        See our <Link href="/shipping-policy">Shipping Policy</Link> and <Link href="/refund-policy">Refund & Return Policy</Link>.
      </p>
      <h2>Liability</h2>
      <p>
        To the extent allowed by law, our liability for any order is limited to the amount paid for that order. We are not responsible for results from supplement use, which vary by person, diet and training.
      </p>
      <h2>Governing law</h2>
      <p>These terms are governed by the laws of India. Courts in {siteConfig.contact.address.district} District, {siteConfig.contact.address.state} have jurisdiction.</p>
    </LegalPage>
  );
}
