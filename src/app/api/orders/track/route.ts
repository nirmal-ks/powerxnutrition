import { errorResponse, json } from "@/lib/api";
import { findCustomerOrder, publicOrder } from "@/lib/orders";

/** Track Order page: order ID + the mobile number used at checkout. POST keeps the phone out of URLs/logs. */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { id?: string; phone?: string };
    const order = await findCustomerOrder(body.id, body.phone);
    if (!order) return json({ error: "No order found with that Order ID and mobile number." }, 404);
    return json({ order: publicOrder(order) });
  } catch (e) {
    return errorResponse(e);
  }
}
