import { siteConfig } from "@/config/site";
import type { CartItem, Order } from "@/types";
import { inr } from "./format";
import { mapsPinUrl } from "./geo";

const PAYMENT_LABEL = { cod: "Cash on Delivery", upi: "UPI", whatsapp: "Confirm on WhatsApp", razorpay: "Online payment (card/UPI/netbanking)" } as const;

export const whatsappLink = (text: string, number: string = siteConfig.whatsappNumber) =>
  `https://wa.me/${number}?text=${encodeURIComponent(text)}`;

export function orderMessage(order: Order) {
  const c = order.customer;
  const lines = [
    `*New Order — ${siteConfig.name}*`,
    `Order ID: *${order.id}*`,
    "",
    `*Customer:* ${c.name}`,
    `*Mobile:* ${c.phone}`,
    c.email ? `*Email:* ${c.email}` : "",
    "",
    "*Products:*",
    ...order.items.map((i, n) => `${n + 1}. ${i.name} (${i.variantLabel}) × ${i.qty} = ${inr(i.price * i.qty)}`),
    "",
    `Subtotal: ${inr(order.subtotal)}`,
    order.discount ? `Coupon ${order.couponCode}: − ${inr(order.discount)}` : "",
    `Delivery: ${order.delivery ? inr(order.delivery) : "FREE"}`,
    `*Total Amount: ${inr(order.total)}*`,
    `Payment: ${PAYMENT_LABEL[order.paymentMethod]}${order.utr ? ` (UTR: ${order.utr})` : ""}`,
    "",
    "*Delivery Address:*",
    c.address,
    `${c.city}, ${c.district}`,
    `${c.state} - ${c.pincode}`,
    order.location ? `Location: ${mapsPinUrl(order.location)} (~${order.location.distanceKm} km)` : "",
    order.notes ? `\nNote: ${order.notes}` : "",
  ];
  return lines.filter((l, i, arr) => !(l === "" && arr[i - 1] === "")).join("\n").trim();
}

export function productEnquiryMessage(name: string, variant?: string) {
  return `Hi ${siteConfig.name}, I'm interested in *${name}*${variant ? ` (${variant})` : ""}. Is it available?`;
}

export function cartEnquiryMessage(items: CartItem[], total: number) {
  return [
    `Hi ${siteConfig.name}, I'd like to order:`,
    ...items.map((i, n) => `${n + 1}. ${i.name} (${i.variantLabel}) × ${i.qty}`),
    `Total: ${inr(total)}`,
  ].join("\n");
}
