import { errorResponse, json } from "@/lib/api";
import { getDb } from "@/lib/db";
import { findCustomerOrder, orderBillPdfUrl, publicOrder } from "@/lib/orders";
import { submitUtr } from "@/lib/server/orders";

/** Customer's confirmation page polls this to see when the shop has verified the payment. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const order = await findCustomerOrder(id, new URL(req.url).searchParams.get("phone"));
    if (!order) return json({ error: "Order not found" }, 404);
    return json({ order: publicOrder(order), billPdfUrl: await orderBillPdfUrl(order.id) });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Customer submits the UPI transaction reference (UTR) after paying. Staff verifies it later. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as { utr?: string; phone?: string };
    const utr = String(body.utr ?? "").replace(/\s/g, "").toUpperCase();
    if (!/^[A-Z0-9]{8,30}$/.test(utr)) return json({ error: "Enter the 12-digit UPI reference / UTR number" }, 400);
    // Phone must match so nobody can tamper with someone else's order.
    const order = await findCustomerOrder(id, body.phone);
    if (!order) return json({ error: "Order not found" }, 404);
    if (order.paymentStatus === "paid") return json({ ok: true, order: publicOrder(order) });
    const db = await getDb();
    const updated = await db.tx((q) => submitUtr(q, order.id, utr));
    return json({ ok: true, order: publicOrder(updated) });
  } catch (e) {
    return errorResponse(e);
  }
}
