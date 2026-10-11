import { siteConfig } from "@/config/site";

/**
 * Standard UPI deep link (NPCI spec). Works as a QR payload and as a tap-to-pay
 * link on phones with GPay / PhonePe / Paytm / BHIM installed.
 */
export function upiLink(amount: number, orderId: string) {
  const params = new URLSearchParams({
    pa: siteConfig.upi.id,
    pn: siteConfig.upi.name,
    am: amount.toFixed(2),
    cu: "INR",
    tn: `PowerX Order ${orderId}`,
  });
  // URLSearchParams encodes spaces as "+", which some UPI apps show literally.
  return `upi://pay?${params.toString().replace(/\+/g, "%20")}`;
}
