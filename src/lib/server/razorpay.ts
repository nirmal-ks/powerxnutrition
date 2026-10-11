import { createHmac, timingSafeEqual } from "node:crypto";
import type { Db } from "@/lib/db/adapter";
import { SYSTEM_ACTOR } from "@/lib/permissions";
import type { Order } from "@/types";
import { audit } from "./audit";
import { AppError, bad, conflict, notFound } from "./errors";
import { updateOrder } from "./orders";

/**
 * Optional Razorpay gateway (switched on only when RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET are set).
 *  - The gateway order is created on the server for the server-computed amount.
 *  - "Paid" is set ONLY after the server verifies Razorpay's signature (checkout callback) or a
 *    signed webhook — never because the browser shows a success page.
 *  - Duplicate callbacks/webhooks are no-ops (payment id is unique in the database).
 */
export const razorpayEnabled = () => Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
export const razorpayKeyId = () => process.env.RAZORPAY_KEY_ID ?? "";

const hmacHex = (secret: string, data: string) => createHmac("sha256", secret).update(data).digest("hex");
const safeEq = (a: string, b: string) => {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
};

export function verifyCheckoutSignature(gatewayOrderId: string, paymentId: string, signature: string, secret = process.env.RAZORPAY_KEY_SECRET ?? "") {
  if (!secret || !gatewayOrderId || !paymentId || !signature) return false;
  return safeEq(hmacHex(secret, `${gatewayOrderId}|${paymentId}`), signature);
}

export function verifyWebhookSignature(rawBody: string, signature: string, secret = process.env.RAZORPAY_WEBHOOK_SECRET ?? "") {
  if (!secret || !signature) return false;
  return safeEq(hmacHex(secret, rawBody), signature);
}

/** Creates (or reuses) the Razorpay order for one of our orders. */
export async function createGatewayOrder(db: Db, orderId: string, fetchImpl: typeof fetch = fetch) {
  if (!razorpayEnabled()) throw new AppError("Online card/UPI gateway is not configured", 503);
  const rows = await db.query<{ data: Order }>("select data from orders where id = $1", [orderId]);
  const order = rows[0]?.data;
  if (!order) throw notFound("Order not found");
  if (order.paymentMethod !== "razorpay") throw bad("This order is not a gateway payment");
  if (order.paymentStatus === "paid") throw conflict("This order is already paid");
  if (order.status === "cancelled") throw conflict("This order was cancelled");
  const pay = await db.query<{ id: string; gateway_order_id: string | null }>(
    "select id, gateway_order_id from payments where order_id = $1 and direction = 'in' order by created_at limit 1",
    [orderId],
  );
  if (pay[0]?.gateway_order_id) return { gatewayOrderId: pay[0].gateway_order_id, amount: Math.round(order.total * 100), keyId: razorpayKeyId() };

  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const res = await fetchImpl("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({ amount: Math.round(order.total * 100), currency: "INR", receipt: order.id, notes: { order_id: order.id } }),
  });
  if (!res.ok) throw new AppError("Couldn't start the online payment. Please try again or choose UPI/COD.", 502);
  const data = (await res.json()) as { id: string; amount: number };
  await db.tx(async (q) => {
    await q.query("update payments set gateway_order_id = $2, updated_at = now() where id = $1", [pay[0]?.id, data.id]);
    await q.query("update orders set data = jsonb_set(data, '{gatewayOrderId}', to_jsonb($2::text)) where id = $1", [orderId, data.id]);
  });
  return { gatewayOrderId: data.id, amount: data.amount, keyId: razorpayKeyId() };
}

/** Marks a gateway payment as verified. Idempotent: a repeated callback/webhook changes nothing. */
export async function markGatewayPaid(db: Db, p: { gatewayOrderId: string; paymentId: string; amountPaise?: number; source: "checkout" | "webhook" }) {
  return db.tx(async (q) => {
    const rows = await q.query<{ id: string; order_id: string; status: string; gateway_payment_id: string | null; amount: number }>(
      "select id, order_id, status, gateway_payment_id, amount from payments where gateway_order_id = $1 for update",
      [p.gatewayOrderId],
    );
    const pay = rows[0];
    if (!pay) throw notFound("Unknown gateway order");
    if (pay.status === "verified") return { duplicate: true, orderId: pay.order_id };
    if (p.amountPaise !== undefined && p.amountPaise !== Math.round(pay.amount * 100)) {
      await audit(q, SYSTEM_ACTOR, "payment.amount_mismatch", { type: "order", id: pay.order_id }, `Gateway amount ${p.amountPaise / 100} ≠ order ${pay.amount}`);
      throw conflict("Paid amount does not match the order total — the shop will check this payment manually.");
    }
    await q.query("update payments set status = 'verified', gateway_payment_id = $2, reference = $2, notes = $3, updated_at = now() where id = $1", [
      pay.id,
      p.paymentId,
      `Verified by Razorpay ${p.source === "webhook" ? "webhook" : "signature"}`,
    ]);
    await updateOrder(q, SYSTEM_ACTOR, pay.order_id, { paymentStatus: "paid" });
    await audit(q, SYSTEM_ACTOR, "payment.verified", { type: "order", id: pay.order_id }, `Razorpay payment ${p.paymentId} verified (${p.source})`);
    return { duplicate: false, orderId: pay.order_id };
  });
}

export async function markGatewayFailed(db: Db, gatewayOrderId: string, reason: string) {
  await db.tx(async (q) => {
    const r = await q.query<{ order_id: string }>(
      "update payments set status = 'failed', notes = $2, updated_at = now() where gateway_order_id = $1 and status in ('pending') returning order_id",
      [gatewayOrderId, `Gateway payment failed: ${reason}`.slice(0, 200)],
    );
    if (r[0]) await audit(q, SYSTEM_ACTOR, "payment.failed", { type: "order", id: r[0].order_id }, `Razorpay payment failed: ${reason}`.slice(0, 200));
  });
}

/** Handles a verified webhook body. Unknown events are acknowledged and ignored. */
export async function handleWebhook(db: Db, body: { event?: string; payload?: Record<string, { entity?: Record<string, unknown> }> }) {
  const payment = body.payload?.payment?.entity as { id?: string; order_id?: string; amount?: number; error_description?: string } | undefined;
  if ((body.event === "payment.captured" || body.event === "order.paid") && payment?.order_id && payment.id) {
    try {
      return await markGatewayPaid(db, { gatewayOrderId: payment.order_id, paymentId: payment.id, amountPaise: payment.amount, source: "webhook" });
    } catch (e) {
      if (e instanceof AppError && e.status === 404) return { ignored: true };
      throw e;
    }
  }
  if (body.event === "payment.failed" && payment?.order_id) {
    await markGatewayFailed(db, payment.order_id, payment.error_description ?? "failed");
    return { failed: true };
  }
  return { ignored: true };
}
