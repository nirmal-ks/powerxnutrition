import { randomBytes } from "node:crypto";
import type { Db, Queryable } from "@/lib/db/adapter";
import { newId } from "@/lib/db/ids";
import { couponDiscount, calcTotals } from "@/lib/pricing";
import type { Actor } from "@/lib/permissions";
import type { Coupon, Customer, Order, OrderItem, OrderStatus, PaymentMethod, PaymentStatus } from "@/types";
import { audit } from "./audit";
import { bad, conflict, notFound } from "./errors";
import { InsufficientStockError } from "./inventory";
import { recordSale, voidSale } from "./sales";
import { getSettings } from "./settings";

/** Customers aren't staff; online-store actions are attributed to this actor in logs and movements. */
export const ONLINE_ACTOR: Actor = { id: "online-store", name: "Online store", role: "cashier" };

const clean = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");

export function validateCustomer(raw: Partial<Customer>): { customer: Customer; errors: Record<string, string> } {
  const customer: Customer = {
    name: clean(raw.name, 80),
    phone: clean(raw.phone, 20).replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, ""),
    email: clean(raw.email, 120).toLowerCase(),
    address: clean(raw.address, 300),
    city: clean(raw.city, 60),
    district: clean(raw.district, 60),
    state: clean(raw.state, 60),
    pincode: clean(raw.pincode, 10).replace(/\D/g, ""),
  };
  const errors: Record<string, string> = {};
  if (customer.name.length < 2) errors.name = "Enter your full name";
  if (!/^[6-9]\d{9}$/.test(customer.phone)) errors.phone = "Enter a valid 10-digit mobile number";
  if (customer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) errors.email = "Enter a valid email";
  if (customer.address.length < 8) errors.address = "Enter your full address (door no, street, area)";
  if (!customer.city) errors.city = "Enter your city";
  if (!customer.district) errors.district = "Enter your district";
  if (!customer.state) errors.state = "Select your state";
  if (!/^[1-9]\d{5}$/.test(customer.pincode)) errors.pincode = "Enter a valid 6-digit pincode";
  return { customer, errors };
}

/** e.g. PX260927-7KQ2 — date + 4 random chars (no ambiguous 0/O/1/I). */
export function newOrderId() {
  const d = new Date(Date.now() + 5.5 * 3600 * 1000); // IST
  const date = d.toISOString().slice(2, 10).replace(/-/g, "");
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const rand = [...randomBytes(4)].map((b) => alphabet[b % alphabet.length]).join("");
  return `PX${date}-${rand}`;
}

const todayIST = () => new Date(Date.now() + 330 * 60 * 1000).toISOString().slice(0, 10);

/** Coupon check inside the order transaction (row locked, so usage limits can't be exceeded by a race). */
async function lockAndEvaluateCoupon(q: Queryable, code: string, subtotal: number, phone: string) {
  const rows = await q.query<{ data: Coupon }>("select data from coupons where code = $1 for update", [code]);
  const c = rows[0]?.data;
  const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
  if (!c || !c.active) throw bad(`“${code}” isn't a valid coupon`);
  if (c.expiresAt && c.expiresAt < todayIST()) throw bad(`“${code}” has expired`);
  if (c.usageLimit && c.used >= c.usageLimit) throw bad(`“${code}” has been fully used`);
  if (subtotal < c.minOrder) throw bad(`Add ${inr(c.minOrder - subtotal)} more to use “${code}” (min. order ${inr(c.minOrder)})`);
  if (c.oncePerCustomer) {
    const used = await q.query(
      "select 1 from orders where phone = $1 and status <> 'cancelled' and data->>'couponCode' = $2 limit 1",
      [phone, code],
    );
    if (used.length) throw bad(`You've already used “${code}” — it's one use per customer`);
  }
  const discount = couponDiscount(c, subtotal);
  if (discount <= 0) throw bad(`“${code}” doesn't apply to this order`);
  return { coupon: c, discount };
}

async function bumpCoupon(q: Queryable, code: string, delta: number) {
  await q.query(
    `update coupons set data = jsonb_set(data, '{used}', to_jsonb(greatest(0, coalesce((data->>'used')::int, 0) + $2))) where code = $1`,
    [code, delta],
  );
}

async function saveOrderRow(q: Queryable, o: Order, extra: { clientKey?: string | null } = {}) {
  await q.query(
    `insert into orders (id, data, status, payment_status, phone, total, client_key, created_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [o.id, JSON.stringify(o), o.status, o.paymentStatus, o.customer.phone, o.total, extra.clientKey ?? null, o.createdAt],
  );
}

async function writeOrder(q: Queryable, o: Order) {
  await q.query("update orders set data = $2, status = $3, payment_status = $4, total = $5, updated_at = now() where id = $1", [
    o.id,
    JSON.stringify(o),
    o.status,
    o.paymentStatus,
    o.total,
  ]);
}

export async function getOrder(q: Queryable, id: string): Promise<Order | null> {
  const r = await q.query<{ data: Order }>("select data from orders where id = $1", [id]);
  return r[0]?.data ?? null;
}

/** Records the online sale (and takes stock out) exactly once per order. */
async function bookOrderSale(q: Queryable, actor: Actor, order: Order) {
  const flag = await q.query<{ id: string }>("update orders set stock_deducted = true where id = $1 and not stock_deducted returning id", [order.id]);
  if (!flag[0]) return null; // already booked — duplicate request
  const s = await getSettings(q);
  const variants = await q.query<{ id: string; slug: string; code: string }>(
    `select v.id, p.slug, v.code from product_variants v join products p on p.id = v.product_id
     where (p.slug || '|' || v.code) = any($1::text[])`,
    [order.items.map((i) => `${i.slug}|${i.variantId}`)],
  );
  const vid = new Map(variants.map((v) => [`${v.slug}|${v.code}`, v.id]));
  const items = order.items.map((i) => {
    const id = vid.get(`${i.slug}|${i.variantId}`);
    if (!id) throw conflict(`${i.name} is no longer available`);
    return { variantId: id, qty: i.qty, unitPrice: i.price };
  });
  const interState = Boolean(order.customer.state) && order.customer.state.toLowerCase() !== s.business.state.toLowerCase();
  const sale = await recordSale(
    q,
    actor,
    {
      channel: "ONLINE",
      items,
      discountPaise: Math.round((order.discount ?? 0) * 100),
      deliveryPaise: Math.round(order.delivery * 100),
      interState,
      placeOfSupply: order.customer.state,
      customer: {
        name: order.customer.name,
        phone: order.customer.phone,
        email: order.customer.email,
        address: { address: order.customer.address, city: order.customer.city, district: order.customer.district, state: order.customer.state, pincode: order.customer.pincode },
      },
      orderId: order.id,
      payments: "auto",
      paymentStatus: order.paymentStatus === "paid" ? "paid" : "unpaid",
      forceInclusive: true, // online prices are always shown as final prices
      notes: `Online order ${order.id}`,
    },
    s,
  );
  await q.query("update orders set sale_id = $2 where id = $1", [order.id, sale.id]);
  await q.query("update payments set sale_id = $2 where order_id = $1 and sale_id is null", [order.id, sale.id]);
  return sale;
}

export interface PlaceOrderInput {
  customer: Customer;
  items: { slug: string; variantId: string; qty: number }[];
  paymentMethod: PaymentMethod;
  location?: { lat: number; lng: number };
  couponCode?: string;
  notes?: string;
  /** Random id generated by the checkout page — the same id never creates two orders. */
  clientKey?: string;
}

/**
 * Creates an online order in ONE transaction: prices re-read from the database (never trusted
 * from the browser), coupon re-checked with a row lock, stock taken out atomically (when the
 * owner's stock stage is "order placed"), the sale recorded and the order saved — or nothing at all.
 */
export async function createOrder(
  db: Db,
  input: PlaceOrderInput,
  ctx: { location?: Order["location"]; razorpayEnabled?: boolean },
): Promise<{ order: Order; duplicate: boolean }> {
  const { customer, errors } = validateCustomer(input.customer ?? {});
  if (Object.keys(errors).length) throw bad(Object.values(errors)[0]);
  const methods: PaymentMethod[] = ["cod", "upi", "whatsapp", ...(ctx.razorpayEnabled ? (["razorpay"] as const) : [])];
  if (!methods.includes(input.paymentMethod)) throw bad("Choose a payment method");
  if (!Array.isArray(input.items) || !input.items.length) throw bad("Your cart is empty");
  const clientKey = typeof input.clientKey === "string" && /^[\w-]{8,64}$/.test(input.clientKey) ? input.clientKey : null;
  if (clientKey) {
    const dup = await db.query<{ data: Order }>("select data from orders where client_key = $1", [clientKey]);
    if (dup[0]) return { order: dup[0].data, duplicate: true };
  }

  try {
    const order = await db.tx(async (q) => {
      const s = await getSettings(q);
      const wanted = input.items.slice(0, 50).map((i) => ({ slug: String(i.slug), code: String(i.variantId), qty: Math.floor(Number(i.qty)) }));
      const rows = await q.query<{ slug: string; code: string; name: string; label: string; flavour: string; price: number; stock: number }>(
        `select p.slug, v.code, p.name, v.label, v.flavour, v.price, v.stock from product_variants v join products p on p.id = v.product_id
         where p.status = 'published' and v.active and (p.slug || '|' || v.code) = any($1::text[])`,
        [wanted.map((w) => `${w.slug}|${w.code}`)],
      );
      const byKey = new Map(rows.map((r) => [`${r.slug}|${r.code}`, r]));
      const items: OrderItem[] = [];
      for (const w of wanted) {
        const r = byKey.get(`${w.slug}|${w.code}`);
        if (!r) throw conflict("A product in your cart is no longer available. Please refresh your cart.");
        if (!(w.qty > 0)) continue;
        if (r.stock < w.qty && !s.operations.allowNegativeStock) {
          throw conflict(r.stock > 0 ? `Only ${r.stock} left of ${r.name} (${r.label}). Please reduce the quantity.` : `${r.name} (${r.label}) just went out of stock.`);
        }
        const label = [r.label, r.flavour].filter(Boolean).join(" · ");
        const same = items.find((x) => x.slug === r.slug && x.variantId === r.code);
        if (same) same.qty += w.qty;
        else items.push({ slug: r.slug, variantId: r.code, name: r.name, variantLabel: label, price: r.price, qty: w.qty });
      }
      if (!items.length) throw bad("Your cart is empty");

      const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
      const code = String(input.couponCode ?? "").trim().toUpperCase().replace(/\s+/g, "");
      const coupon = code ? await lockAndEvaluateCoupon(q, code, subtotal, customer.phone) : null;
      const totals = calcTotals(subtotal, coupon?.discount ?? 0);
      const o: Order = {
        id: newOrderId(),
        createdAt: new Date().toISOString(),
        customer,
        items,
        subtotal: totals.subtotal,
        delivery: totals.delivery,
        ...(coupon ? { discount: totals.discount, couponCode: coupon.coupon.code } : {}),
        total: totals.total,
        paymentMethod: input.paymentMethod,
        paymentStatus: "unpaid",
        location: ctx.location,
        status: "new",
        notes: clean(input.notes, 300) || undefined,
      };
      await saveOrderRow(q, o, { clientKey });
      if (input.paymentMethod !== "whatsapp") {
        await q.query(
          `insert into payments (id, order_id, direction, method, amount, status, recorded_by, notes) values ($1,$2,'in',$3,$4,'pending',$5,$6)`,
          [newId(), o.id, input.paymentMethod, o.total, ONLINE_ACTOR.id, input.paymentMethod === "cod" ? "Collect on delivery" : "Awaiting payment"],
        );
      }
      if (coupon) await bumpCoupon(q, coupon.coupon.code, 1);
      if (s.operations.onlineStockStage === "placed") {
        const sale = await bookOrderSale(q, ONLINE_ACTOR, o);
        if (sale) {
          o.billNo = sale.billNo;
          await writeOrder(q, o);
        }
      }
      await audit(q, ONLINE_ACTOR, "order.placed", { type: "order", id: o.id }, `${o.id} · ₹${o.total} · ${o.paymentMethod.toUpperCase()} · ${customer.name}`, {
        items: o.items.length,
        coupon: o.couponCode,
      });
      return o;
    });
    return { order, duplicate: false };
  } catch (e) {
    if (String((e as Error)?.message ?? "").includes("orders_client_key_key") && clientKey) {
      const dup = await db.query<{ data: Order }>("select data from orders where client_key = $1", [clientKey]);
      if (dup[0]) return { order: dup[0].data, duplicate: true };
    }
    if (e instanceof InsufficientStockError) throw conflict(`${e.variantName}: only ${Math.max(0, e.available)} left. Please reduce the quantity.`);
    throw e;
  }
}

const STATUSES: OrderStatus[] = ["new", "confirmed", "shipped", "delivered", "cancelled"];
const PAYMENT: PaymentStatus[] = ["unpaid", "verifying", "paid", "refunded"];

/**
 * Admin changes to an order. Cancelling reverses stock through a cancellation document (never by
 * editing history). With the "confirmed" stock stage, stock is taken when the order is confirmed.
 */
export async function updateOrder(q: Queryable, actor: Actor, id: string, body: Partial<Order> & { cancelReason?: string }) {
  const rows = await q.query<{ data: Order; stock_deducted: boolean; sale_id: string | null }>(
    "select data, stock_deducted, sale_id from orders where id = $1 for update",
    [id],
  );
  if (!rows[0]) throw notFound("Order not found");
  const current = rows[0].data;
  const next: Order = { ...current };
  const changes: string[] = [];

  if (body.status && STATUSES.includes(body.status) && body.status !== current.status) {
    if (current.status === "cancelled") throw bad("Cancelled orders can't be reopened — ask the customer to place a new order.");
    next.status = body.status;
    changes.push(`status ${current.status}→${body.status}`);
  }
  if (body.paymentStatus && PAYMENT.includes(body.paymentStatus) && body.paymentStatus !== current.paymentStatus) {
    if (current.paymentMethod === "razorpay" && body.paymentStatus === "paid" && actor.id !== "system") {
      throw bad("Razorpay payments are marked paid automatically after the gateway verifies them.");
    }
    next.paymentStatus = body.paymentStatus;
    changes.push(`payment ${current.paymentStatus}→${body.paymentStatus}`);
  }
  if (typeof body.adminNotes === "string") next.adminNotes = body.adminNotes.slice(0, 1000);
  if (typeof body.tracking === "string") next.tracking = body.tracking.trim().slice(0, 300);

  if (current.paymentMethod === "upi" && next.status !== current.status && !["new", "cancelled"].includes(next.status) && next.paymentStatus !== "paid") {
    throw bad("Verify the UPI payment and mark it “paid” before confirming or shipping this order.");
  }

  // Stock stage "confirmed": book the sale (takes stock) when the order moves past "new".
  if (!rows[0].stock_deducted && ["confirmed", "shipped", "delivered"].includes(next.status)) {
    try {
      const sale = await bookOrderSale(q, actor, next);
      if (sale) next.billNo = sale.billNo;
    } catch (e) {
      if (e instanceof InsufficientStockError) throw conflict(`Not enough stock to confirm: ${e.message}`);
      throw e;
    }
  }

  if (next.status === "cancelled" && current.status !== "cancelled") {
    const reason = String(body.cancelReason ?? "").trim() || "Order cancelled";
    if (rows[0].sale_id) {
      const refundMethod = current.paymentStatus === "paid" ? (current.paymentMethod === "razorpay" ? "razorpay" : current.paymentMethod === "upi" ? "upi" : "cash") : "none";
      await voidSale(q, actor, rows[0].sale_id, reason, refundMethod, "CANCELLATION");
    }
    if (current.couponCode) await bumpCoupon(q, current.couponCode, -1);
    await q.query("update payments set status = 'failed', updated_at = now(), notes = 'Order cancelled' where order_id = $1 and status = 'pending'", [id]);
  }

  if (next.paymentStatus !== current.paymentStatus) {
    const status = next.paymentStatus === "paid" ? (current.paymentMethod === "cod" ? "received" : "verified") : next.paymentStatus === "refunded" ? "refunded" : next.paymentStatus === "verifying" ? "verifying" : "pending";
    const note = next.paymentStatus === "paid" && current.paymentMethod === "upi" ? `Verified manually in UPI app by ${actor.name}` : `Set to ${next.paymentStatus} by ${actor.name}`;
    const upd = await q.query("update payments set status = $2, notes = $3, updated_at = now() where order_id = $1 and direction = 'in' returning id", [id, status, note]);
    if (!upd.length && next.paymentStatus === "paid") {
      await q.query(
        `insert into payments (id, order_id, sale_id, direction, method, amount, status, recorded_by, notes) values ($1,$2,$3,'in',$4,$5,$6,$7,$8)`,
        [newId(), id, rows[0].sale_id, current.paymentMethod === "whatsapp" ? "other" : current.paymentMethod, current.total, status, actor.id, note],
      );
    }
    await q.query("update sales set payment_status = $2 where order_id = $1 and status not in ('cancelled')", [
      id,
      next.paymentStatus === "paid" ? "paid" : next.paymentStatus === "refunded" ? "refunded" : "unpaid",
    ]);
  }

  await writeOrder(q, next);
  if (changes.length) {
    await audit(q, actor, next.status === "cancelled" && current.status !== "cancelled" ? "order.cancelled" : "order.updated", { type: "order", id }, `${id}: ${changes.join(", ")}`, {
      from: { status: current.status, payment: current.paymentStatus },
      to: { status: next.status, payment: next.paymentStatus },
      reason: body.cancelReason,
    });
  }
  return next;
}

export async function listOrders(q: Queryable, limit = 1000) {
  const rows = await q.query<{ data: Order }>("select data from orders order by created_at desc limit $1", [limit]);
  return rows.map((r) => r.data);
}

/** Customer submits the UTR after paying by UPI. */
export async function submitUtr(q: Queryable, id: string, utr: string) {
  const rows = await q.query<{ data: Order }>("select data from orders where id = $1 for update", [id]);
  const o = rows[0]?.data;
  if (!o) throw notFound("Order not found");
  if (o.paymentStatus === "paid") return o;
  const next: Order = { ...o, utr, paymentStatus: "verifying" };
  await writeOrder(q, next);
  await q.query("update payments set status = 'verifying', reference = $2, updated_at = now() where order_id = $1 and direction = 'in' and status in ('pending','verifying')", [id, utr]);
  await audit(q, ONLINE_ACTOR, "payment.utr_submitted", { type: "order", id }, `Customer entered UTR ${utr} for ${id}`);
  return next;
}
