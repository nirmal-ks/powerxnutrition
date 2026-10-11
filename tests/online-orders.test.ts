import { createHmac } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/adapter";
import { createOrder, getOrder, updateOrder } from "@/lib/server/orders";
import { createGatewayOrder, handleWebhook, markGatewayPaid, verifyCheckoutSignature, verifyWebhookSignature } from "@/lib/server/razorpay";
import { saveSettings } from "@/lib/server/settings";
import { MANAGER, OWNER, movementCount, stockOf, testDb, txnId, variantId } from "./helpers/db";

let db: Db;
let whey1: string;
const customer = { name: "Priya S", phone: "9840012345", email: "priya@example.com", address: "4 Lake View Road, T Nagar", city: "Chennai", district: "Chennai", state: "Tamil Nadu", pincode: "600017" };
const order = (qty = 1, extra: Record<string, unknown> = {}) => ({ customer, items: [{ slug: "on-gold-whey", variantId: "1-kg", qty }], paymentMethod: "upi" as const, clientKey: txnId(), ...extra });

beforeAll(async () => {
  db = await testDb();
  whey1 = await variantId(db, "on-gold-whey", "1-kg");
  process.env.RAZORPAY_KEY_ID = "rzp_test_key";
  process.env.RAZORPAY_KEY_SECRET = "test_secret";
  process.env.RAZORPAY_WEBHOOK_SECRET = "hook_secret";
});
afterAll(() => db.close());

describe("online orders", () => {
  it("valid order: server prices, stock taken once, ONLINE sale + bill number recorded", async () => {
    const before = await stockOf(db, whey1);
    const { order: o, duplicate } = await createOrder(db, { ...order(2), items: [{ slug: "on-gold-whey", variantId: "1-kg", qty: 2, price: 1 } as never] }, {});
    expect(duplicate).toBe(false);
    expect(o.items[0].price).toBe(3500); // browser price ignored
    expect(o.total).toBe(7000);
    expect(o.billNo).toMatch(/^PXR\//);
    expect(await stockOf(db, whey1)).toBe(before - 2);
    const sale = await db.query<{ channel: string; total: number }>("select channel, total from sales where order_id = $1", [o.id]);
    expect(sale[0]).toEqual({ channel: "ONLINE", total: 7000 });
    expect(await movementCount(db, "type = 'SALE_ONLINE' and note like $1", [`%${o.id}%`])).toBe(1);
  });

  it("duplicate submission (same checkout key) returns the first order — no second order or deduction", async () => {
    const input = order(1);
    const before = await stockOf(db, whey1);
    const a = await createOrder(db, input, {});
    const b = await createOrder(db, input, {});
    expect(b.duplicate).toBe(true);
    expect(b.order.id).toBe(a.order.id);
    expect(await stockOf(db, whey1)).toBe(before - 1);
  });

  it("rejects ordering more than is in stock", async () => {
    const stock = await stockOf(db, whey1);
    await expect(createOrder(db, order(stock + 1), {})).rejects.toThrow(/left|out of stock/);
    expect(await stockOf(db, whey1)).toBe(stock);
  });

  it("cancellation creates a reversal and puts stock back exactly once", async () => {
    const { order: o } = await createOrder(db, order(3), {});
    const before = await stockOf(db, whey1);
    await db.tx((q) => updateOrder(q, MANAGER, o.id, { status: "cancelled", cancelReason: "Customer asked" }));
    expect(await stockOf(db, whey1)).toBe(before + 3);
    await expect(db.tx((q) => updateOrder(q, MANAGER, o.id, { status: "confirmed" }))).rejects.toThrow(/can't be reopened/);
    expect(await stockOf(db, whey1)).toBe(before + 3);
    const s = await db.query<{ status: string }>("select status from sales where order_id = $1", [o.id]);
    expect(s[0].status).toBe("cancelled");
  });

  it("with the 'confirmed' stock stage, stock is taken on confirmation, once", async () => {
    await db.tx((q) => saveSettings(q, OWNER, "operations", { onlineStockStage: "confirmed" }));
    const before = await stockOf(db, whey1);
    const { order: o } = await createOrder(db, { ...order(1), paymentMethod: "whatsapp" }, {});
    expect(await stockOf(db, whey1)).toBe(before);
    await db.tx((q) => updateOrder(q, MANAGER, o.id, { status: "confirmed" }));
    await db.tx((q) => updateOrder(q, MANAGER, o.id, { status: "shipped" }));
    expect(await stockOf(db, whey1)).toBe(before - 1);
    await db.tx((q) => saveSettings(q, OWNER, "operations", { onlineStockStage: "placed" }));
  });

  it("UPI orders can't be confirmed until the payment is marked paid", async () => {
    const { order: o } = await createOrder(db, order(1), {});
    await expect(db.tx((q) => updateOrder(q, MANAGER, o.id, { status: "confirmed" }))).rejects.toThrow(/Verify the UPI payment/);
    await db.tx((q) => updateOrder(q, MANAGER, o.id, { paymentStatus: "paid" }));
    const p = await db.query<{ status: string; notes: string }>("select status, notes from payments where order_id = $1", [o.id]);
    expect(p[0].status).toBe("verified");
    expect(p[0].notes).toMatch(/Verified manually/);
  });
});

describe("Razorpay gateway (optional)", () => {
  const fakeFetch = (async () => new Response(JSON.stringify({ id: "order_RZP123", amount: 350000 }), { status: 200 })) as unknown as typeof fetch;
  let orderId = "";

  it("creates the gateway order on the server for OUR amount", async () => {
    const { order: o } = await createOrder(db, { ...order(1), paymentMethod: "razorpay" }, { razorpayEnabled: true });
    orderId = o.id;
    let sent: { amount?: number } = {};
    const spy = (async (_u: string, init: RequestInit) => {
      sent = JSON.parse(String(init.body));
      return fakeFetch("");
    }) as unknown as typeof fetch;
    const g = await createGatewayOrder(db, o.id, spy);
    expect(g.gatewayOrderId).toBe("order_RZP123");
    expect(sent.amount).toBe(350000);
    // second call reuses it
    const g2 = await createGatewayOrder(db, o.id, (async () => { throw new Error("should not call"); }) as unknown as typeof fetch);
    expect(g2.gatewayOrderId).toBe("order_RZP123");
  });

  it("failed payment: browser 'success' without a valid signature is rejected; payment.failed is recorded", async () => {
    expect(verifyCheckoutSignature("order_RZP123", "pay_1", "forged")).toBe(false);
    await handleWebhook(db, { event: "payment.failed", payload: { payment: { entity: { order_id: "order_RZP123", error_description: "Card declined" } } } });
    const p = await db.query<{ status: string }>("select status from payments where gateway_order_id = 'order_RZP123'");
    expect(p[0].status).toBe("failed");
    expect((await getOrder(db, orderId))!.paymentStatus).toBe("unpaid");
    await db.query("update payments set status = 'pending' where gateway_order_id = 'order_RZP123'"); // customer retries
  });

  it("verified payment: valid signature marks the order paid", async () => {
    const sig = createHmac("sha256", "test_secret").update("order_RZP123|pay_OK1").digest("hex");
    expect(verifyCheckoutSignature("order_RZP123", "pay_OK1", sig)).toBe(true);
    const r = await markGatewayPaid(db, { gatewayOrderId: "order_RZP123", paymentId: "pay_OK1", source: "checkout" });
    expect(r.duplicate).toBe(false);
    expect((await getOrder(db, orderId))!.paymentStatus).toBe("paid");
  });

  it("duplicate webhook is harmless", async () => {
    const body = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_OK1", order_id: "order_RZP123", amount: 350000 } } } });
    const sig = createHmac("sha256", "hook_secret").update(body).digest("hex");
    expect(verifyWebhookSignature(body, sig)).toBe(true);
    expect(verifyWebhookSignature(body, "bad")).toBe(false);
    const a = await handleWebhook(db, JSON.parse(body));
    const b = await handleWebhook(db, JSON.parse(body));
    expect(a).toMatchObject({ duplicate: true });
    expect(b).toMatchObject({ duplicate: true });
    const audits = await db.query("select 1 from audit_logs where action = 'payment.verified' and entity_id = $1", [orderId]);
    expect(audits.length).toBe(1);
  });

  it("staff can't mark a gateway order paid by hand; amount mismatch is refused", async () => {
    const { order: o } = await createOrder(db, { ...order(1), paymentMethod: "razorpay" }, { razorpayEnabled: true });
    await expect(db.tx((q) => updateOrder(q, OWNER, o.id, { paymentStatus: "paid" }))).rejects.toThrow(/automatically/);
    await createGatewayOrder(db, o.id, (async () => new Response(JSON.stringify({ id: "order_RZP999", amount: 350000 }))) as unknown as typeof fetch);
    await expect(markGatewayPaid(db, { gatewayOrderId: "order_RZP999", paymentId: "pay_X", amountPaise: 100, source: "webhook" })).rejects.toThrow(/does not match/);
    expect((await getOrder(db, o.id))!.paymentStatus).toBe("unpaid");
  });
});
