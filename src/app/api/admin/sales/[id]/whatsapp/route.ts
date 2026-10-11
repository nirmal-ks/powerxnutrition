import { json, readJson, staffRoute } from "@/lib/api";
import { sendSaleBillOnWhatsApp } from "@/lib/server/bill-whatsapp";

/** Send a POS bill's PDF to a WhatsApp number (auto via Cloud API, else a prefilled wa.me link). */
export const POST = staffRoute<{ id: string }>("sales.view", async (req, { db, actor, params }) => {
  const { phone } = await readJson<{ phone?: string }>(req);
  return json(await sendSaleBillOnWhatsApp(db, actor, params.id, String(phone ?? "")));
});
