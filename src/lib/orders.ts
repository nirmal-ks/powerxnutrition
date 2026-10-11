import "server-only";
import { siteConfig } from "@/config/site";
import { getDb } from "@/lib/db";
import { razorpayEnabled } from "@/lib/server/razorpay";
import { receiptPdfUrl } from "@/lib/server/receipt-link";
import { createOrder, getOrder, type PlaceOrderInput } from "@/lib/server/orders";
import type { Order, PublicOrder } from "@/types";
import { distanceFromShopKm, isLatLng, withinCodRadius } from "./geo";
import { StoreError } from "./store";

export { validateCustomer } from "@/lib/server/orders";
export type { PlaceOrderInput } from "@/lib/server/orders";

/**
 * Creates an online order. Prices always come from the database on the server — never from the
 * browser. Stock, coupon usage and the sale record are written in one transaction.
 */
export async function placeOrder(input: PlaceOrderInput): Promise<{ order: Order; persisted: boolean; duplicate: boolean }> {
  let location: Order["location"];
  if (isLatLng(input.location)) {
    location = { lat: input.location.lat, lng: input.location.lng, distanceKm: distanceFromShopKm(input.location) };
  }
  if (input.paymentMethod === "cod") {
    const radius = siteConfig.delivery.codRadiusKm;
    if (!location) throw new StoreError("Share your location to check Cash on Delivery availability, or pay by UPI.", 400);
    if (!withinCodRadius(location.distanceKm)) {
      throw new StoreError(`Cash on Delivery is available only within ${radius} km of our shop (you are ~${location.distanceKm} km away). Please pay by UPI.`, 400);
    }
  }
  const db = await getDb();
  const { order, duplicate } = await createOrder(db, input, { location, razorpayEnabled: razorpayEnabled() });
  return { order, persisted: true, duplicate };
}

/**
 * Signed link to the order's bill PDF, once the sale is recorded (stock stage reached).
 * Null while the order isn't billed yet or if it was cancelled.
 */
export async function orderBillPdfUrl(orderId: string): Promise<string | null> {
  const db = await getDb();
  const r = await db.query<{ id: string }>("select id from sales where order_id = $1 and status <> 'cancelled' limit 1", [orderId]);
  return r[0] ? receiptPdfUrl(r[0].id) : null;
}

/** Strips shop-only fields before an order is sent to the customer's browser. */
export function publicOrder(order: Order): PublicOrder {
  const { adminNotes: _notes, location: _location, ...rest } = order;
  return rest;
}

/** Finds an order only if the phone number matches (the customer's "password" for their order). */
export async function findCustomerOrder(id: unknown, phone: unknown) {
  const cleanId = String(id ?? "").trim().toUpperCase();
  const cleanPhone = String(phone ?? "").replace(/\D/g, "").slice(-10);
  if (!/^PX\d{6}-[A-Z0-9]{4}$/.test(cleanId) || cleanPhone.length !== 10) return null;
  const order = await getOrder(await getDb(), cleanId);
  return order && order.customer.phone === cleanPhone ? order : null;
}
