import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { PageHero } from "@/components/ui/PageHero";
import { razorpayEnabled } from "@/lib/server/razorpay";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };
export const dynamic = "force-dynamic";

export default function CheckoutPage() {
  return (
    <>
      <PageHero title="Secure" highlight="Checkout" crumbs={[{ href: "/cart", label: "Cart" }, { label: "Checkout" }]} />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <CheckoutForm gatewayEnabled={razorpayEnabled()} />
      </div>
    </>
  );
}
