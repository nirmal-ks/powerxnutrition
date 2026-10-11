import { errorResponse, json } from "@/lib/api";
import { getDb } from "@/lib/db";
import { findCustomerOrder } from "@/lib/orders";
import { createGatewayOrder } from "@/lib/server/razorpay";

/** Creates the Razorpay order on the server, for the amount stored on OUR order (never the browser's). */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { orderId?: string; phone?: string };
    const order = await findCustomerOrder(body.orderId, body.phone);
    if (!order) return json({ error: "Order not found" }, 404);
    return json(await createGatewayOrder(await getDb(), order.id));
  } catch (e) {
    return errorResponse(e);
  }
}
