import type { Metadata } from "next";
import { LegalPage } from "@/components/ui/LegalPage";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: "Privacy Policy", alternates: { canonical: "/privacy-policy" } };

export default function PrivacyPage() {
  const { contact } = siteConfig;
  return (
    <LegalPage title="Privacy" highlight="Policy" updated="27 September 2026">
      <p>
        {siteConfig.name} (“we”, “us”) respects your privacy. This policy explains what information we collect when you use our website or order from us, and how we use it.
      </p>
      <h2>Information we collect</h2>
      <ul>
        <li>Details you give at checkout: name, mobile number, email (optional), delivery address, city, district, state and pincode.</li>
        <li>Order details: products, quantities, amounts, payment method and any UPI transaction reference you share.</li>
        <li>
          Your device location, only if you choose Cash on Delivery — used once at checkout to check you are within {siteConfig.delivery.codRadiusKm} km of our shop, and saved with that order to help us deliver.
        </li>
        <li>Messages you send us on WhatsApp, phone or email.</li>
        <li>Your cart and saved checkout details are stored only in your own browser (local storage) for convenience.</li>
      </ul>
      <h2>How we use it</h2>
      <ul>
        <li>To process, deliver and support your orders.</li>
        <li>To contact you about your order via call, SMS or WhatsApp.</li>
        <li>To verify payments and prevent fraud.</li>
        <li>To meet legal, tax and accounting obligations.</li>
      </ul>
      <h2>Payments</h2>
      <p>
        We accept Cash on Delivery and UPI. UPI payments are made directly in your own UPI app — we never see or store your bank details, card numbers, UPI PIN or OTPs.
        We will never ask you for your PIN or OTP.
      </p>
      <h2>Sharing</h2>
      <p>
        We do not sell your data. We share only what is needed with courier partners to deliver your order, and with authorities when required by law.
      </p>
      <h2>Data security & retention</h2>
      <p>We use reasonable safeguards to protect your data and keep order records only as long as needed for business and legal purposes.</p>
      <h2>Your choices</h2>
      <p>
        You can ask us to access, correct or delete your personal information by contacting us at <a href={`mailto:${contact.email}`}>{contact.email}</a> or {contact.phone}.
      </p>
      <h2>Contact</h2>
      <p>
        {siteConfig.name}, {contact.address.line1}, {contact.address.line2}, {contact.address.district} District, {contact.address.state} – {contact.address.pincode}.
      </p>
    </LegalPage>
  );
}
