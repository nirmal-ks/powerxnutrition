import type { Metadata } from "next";
import { CartView } from "@/components/cart/CartView";
import { PageHero } from "@/components/ui/PageHero";

export const metadata: Metadata = { title: "Your Cart", robots: { index: false } };

export default function CartPage() {
  return (
    <>
      <PageHero title="Your" highlight="Cart" crumbs={[{ label: "Cart" }]} />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <CartView />
      </div>
    </>
  );
}
