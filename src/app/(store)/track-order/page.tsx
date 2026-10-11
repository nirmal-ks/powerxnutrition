import type { Metadata } from "next";
import { Suspense } from "react";
import { TrackOrder } from "@/components/order/TrackOrder";
import { PageHero } from "@/components/ui/PageHero";

export const metadata: Metadata = {
  title: "Track Your Order",
  description: "Check the status of your PowerX Nutrition order with your Order ID and mobile number.",
  alternates: { canonical: "/track-order" },
};

export default function TrackOrderPage() {
  return (
    <>
      <PageHero title="Track your" highlight="order" subtitle="See payment and delivery status any time — no login needed." crumbs={[{ label: "Track order" }]} />
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-white/5" />}>
          <TrackOrder />
        </Suspense>
      </div>
    </>
  );
}
