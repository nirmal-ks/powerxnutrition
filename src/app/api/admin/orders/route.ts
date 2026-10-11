import { json, staffRoute } from "@/lib/api";
import { listOrders } from "@/lib/server/orders";

export const GET = staffRoute("orders.manage", async (_req, { db }) => json({ orders: await listOrders(db) }));
