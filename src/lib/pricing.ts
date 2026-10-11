import { siteConfig } from "@/config/site";
import type { PublicCoupon } from "@/types";

/**
 * Delivery + total calculation — shared by the cart UI and the order API so they always agree.
 * Free delivery is judged on the item subtotal before any coupon, so a coupon never "costs" delivery.
 */
export function calcTotals(subtotal: number, discount = 0) {
  const { charge, freeAbove } = siteConfig.delivery;
  const delivery = subtotal === 0 || subtotal >= freeAbove ? 0 : charge;
  const off = Math.min(Math.max(0, Math.round(discount)), subtotal);
  return { subtotal, delivery, discount: off, total: subtotal - off + delivery, freeAbove, remainingForFree: Math.max(0, freeAbove - subtotal) };
}

/** ₹ off a subtotal for a coupon (0 if the minimum isn't met). */
export function couponDiscount(c: PublicCoupon, subtotal: number) {
  if (subtotal <= 0 || subtotal < c.minOrder) return 0;
  const raw = c.type === "percent" ? (subtotal * c.value) / 100 : c.value;
  const capped = c.type === "percent" && c.maxDiscount > 0 ? Math.min(raw, c.maxDiscount) : raw;
  return Math.min(Math.round(capped), subtotal);
}

/** "10% off (up to ₹200)" / "₹100 off" */
export function couponLabel(c: PublicCoupon) {
  const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
  return c.type === "percent" ? `${c.value}% off${c.maxDiscount > 0 ? ` (up to ${inr(c.maxDiscount)})` : ""}` : `${inr(c.value)} off`;
}
