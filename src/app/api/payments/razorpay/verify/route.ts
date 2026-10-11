import { errorResponse, json } from "@/lib/api";
import { getDb } from "@/lib/db";
import { findCustomerOrder, publicOrder } from "@/lib/orders";
import { getOrder } from "@/lib/server/orders";
import { markGatewayPaid, verifyCheckoutSignature } from "@/lib/server/razorpay";

/** Checkout callback: the order becomes "paid" only if Razorpay's signature verifies on the server. */
export async function POST(req: Request) {
  try {
    const b = (await req.json().catch(() => ({}))) as {
      orderId?: string;
      phone?: string;
      razorpay_payment_id?: string;
      razorpay_order_id?: string;
      razorpay_signature?: string;
    };
    const order = await findCustomerOrder(b.orderId, b.phone);
    if (!order) return json({ error: "Order not found" }, 404);
    if (!b.razorpay_order_id || b.razorpay_order_id !== order.gatewayOrderId) return json({ error: "Payment doesn't belong to this order" }, 400);
    if (!verifyCheckoutSignature(b.razorpay_order_id, String(b.razorpay_payment_id ?? ""), String(b.razorpay_signature ?? ""))) {
      return json({ error: "Payment could not be verified. If money was deducted, it will be confirmed automatically, or contact us." }, 400);
    }
    const db = await getDb();
    await markGatewayPaid(db, { gatewayOrderId: b.razorpay_order_id, paymentId: String(b.razorpay_payment_id), source: "checkout" });
    const fresh = await getOrder(db, order.id);
    return json({ ok: true, order: fresh && publicOrder(fresh) });
  } catch (e) {
    return errorResponse(e);
  }
}
