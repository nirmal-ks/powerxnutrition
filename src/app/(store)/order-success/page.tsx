import type { Metadata } from "next";
import { Suspense } from "react";
import { OrderSuccess } from "@/components/order/OrderSuccess";

export const metadata: Metadata = { title: "Order Confirmed", robots: { index: false } };

export default function OrderSuccessPage() {
  return (
    <div className="relative overflow-hidden px-4 py-12 sm:px-6 sm:py-16">
      <div className="bg-grid absolute inset-0" />
      <div className="absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-green-500/10 blur-[100px]" />
      <div className="relative">
        <Suspense>
          <OrderSuccess />
        </Suspense>
      </div>
    </div>
  );
}
