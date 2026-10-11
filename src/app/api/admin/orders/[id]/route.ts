import { json, readJson, staffRoute } from "@/lib/api";
import { getOrder, updateOrder } from "@/lib/server/orders";
import { revalidateStore } from "@/lib/server/revalidate";
import type { Order } from "@/types";

type P = { id: string };

export const GET = staffRoute<P>("orders.manage", async (_req, { db, params }) => {
  const order = await getOrder(db, params.id);
  return order ? json({ order }) : json({ error: "Order not found" }, 404);
});

/** Status / payment / tracking changes. Cancelling creates a stock reversal (never edits history). */
export const PATCH = staffRoute<P>("orders.manage", async (req, { db, actor, params }) => {
  const body = await readJson<Partial<Order> & { cancelReason?: string }>(req);
  const order = await db.tx((q) => updateOrder(q, actor, params.id, body));
  if (body.status) revalidateStore();
  return json({ order });
});
