import { json, readJson, staffRoute } from "@/lib/api";
import { sendSaleBillOnWhatsApp } from "@/lib/server/bill-whatsapp";
import { conflict } from "@/lib/server/errors";

/** Send an online order's bill PDF on WhatsApp (needs the order to be billed / stock-deducted). */
export const POST = staffRoute<{ id: string }>("orders.manage", async (req, { db, actor, params }) => {
  const { phone } = await readJson<{ phone?: string }>(req);
  const sale = (await db.query<{ id: string }>("select id from sales where order_id = $1 and status <> 'cancelled' limit 1", [params.id]))[0];
  if (!sale) throw conflict("This order has no bill yet — confirm the order first (the bill is created when stock is taken).");
  return json(await sendSaleBillOnWhatsApp(db, actor, sale.id, String(phone ?? "")));
});
