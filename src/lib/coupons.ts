import "server-only";
import type { Coupon, PublicCoupon } from "@/types";
import { couponDiscount } from "./pricing";
import { getStore, StoreError } from "./store";

export const normalizeCode = (v: unknown) => String(v ?? "").trim().toUpperCase().replace(/\s+/g, "");

/** Today's date in India as "YYYY-MM-DD". */
const todayIST = () => new Date(Date.now() + 330 * 60 * 1000).toISOString().slice(0, 10);

export const toPublicCoupon = (c: Coupon): PublicCoupon => ({
  code: c.code,
  type: c.type,
  value: c.value,
  minOrder: c.minOrder,
  maxDiscount: c.maxDiscount,
  expiresAt: c.expiresAt,
  description: c.description,
});

const isLive = (c: Coupon) =>
  c.active && (!c.expiresAt || c.expiresAt >= todayIST()) && (!c.usageLimit || c.used < c.usageLimit);

/** Offers listed at checkout. */
export async function listCheckoutOffers() {
  return (await getStore().listCoupons()).filter((c) => c.showAtCheckout && isLive(c)).map(toPublicCoupon);
}

/**
 * Checks a code against a subtotal (and the customer's phone for once-per-customer coupons).
 * Throws a friendly StoreError when it can't be used.
 */
export async function evaluateCoupon(rawCode: unknown, subtotal: number, phone?: string) {
  const code = normalizeCode(rawCode);
  if (!code) throw new StoreError("Enter a coupon code", 400);
  const store = getStore();
  const c = await store.getCoupon(code);
  const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

  if (!c || !c.active) throw new StoreError(`“${code}” isn't a valid coupon`, 404);
  if (c.expiresAt && c.expiresAt < todayIST()) throw new StoreError(`“${code}” has expired`, 400);
  if (c.usageLimit && c.used >= c.usageLimit) throw new StoreError(`“${code}” has been fully used`, 400);
  if (subtotal < c.minOrder) throw new StoreError(`Add ${inr(c.minOrder - subtotal)} more to use “${code}” (min. order ${inr(c.minOrder)})`, 400);

  const cleanPhone = String(phone ?? "").replace(/\D/g, "").slice(-10);
  if (c.oncePerCustomer && cleanPhone.length === 10) {
    const orders = await store.listOrders();
    if (orders.some((o) => o.couponCode === code && o.customer.phone === cleanPhone && o.status !== "cancelled")) {
      throw new StoreError(`You've already used “${code}” — it's one use per customer`, 400);
    }
  }

  const discount = couponDiscount(c, subtotal);
  if (discount <= 0) throw new StoreError(`“${code}” doesn't apply to this order`, 400);
  return { coupon: c, discount };
}

/** Counts one use (called after an order with this coupon is saved). */
export async function markCouponUsed(code: string) {
  const store = getStore();
  const c = await store.getCoupon(code);
  if (c) await store.saveCoupon({ ...c, used: c.used + 1 });
}

/** Gives a use back when an order with this coupon is cancelled. */
export async function releaseCoupon(code: string) {
  const store = getStore();
  const c = await store.getCoupon(code);
  if (c && c.used > 0) await store.saveCoupon({ ...c, used: c.used - 1 });
}

/** Validates admin input into a Coupon. Returns [coupon, error]. */
export function parseCouponInput(raw: Partial<Coupon>, existing?: Coupon): [Coupon | null, string] {
  const code = normalizeCode(raw.code ?? existing?.code);
  if (!/^[A-Z0-9_-]{3,20}$/.test(code)) return [null, "Code must be 3–20 letters/numbers (e.g. FIRST10)"];
  const type = raw.type === "flat" ? "flat" : "percent";
  const value = Math.round(Number(raw.value));
  if (!(value > 0)) return [null, "Enter the discount value"];
  if (type === "percent" && value > 90) return [null, "Percentage can't be more than 90%"];
  const num = (v: unknown) => Math.max(0, Math.round(Number(v) || 0));
  const expiresAt = typeof raw.expiresAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.expiresAt) ? raw.expiresAt : undefined;
  return [
    {
      code,
      type,
      value,
      minOrder: num(raw.minOrder),
      maxDiscount: type === "percent" ? num(raw.maxDiscount) : 0,
      expiresAt,
      usageLimit: num(raw.usageLimit),
      used: existing?.used ?? 0,
      oncePerCustomer: Boolean(raw.oncePerCustomer),
      showAtCheckout: Boolean(raw.showAtCheckout),
      active: raw.active === undefined ? (existing?.active ?? true) : Boolean(raw.active),
      description: String(raw.description ?? "").trim().slice(0, 80) || undefined,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    },
    "",
  ];
}
