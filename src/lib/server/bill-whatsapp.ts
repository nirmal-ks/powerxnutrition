import type { Db } from "@/lib/db/adapter";
import { inr2 } from "@/lib/money";
import type { Actor } from "@/lib/permissions";
import { audit } from "./audit";
import { cleanPhone, isMobile, upsertCustomer } from "./customers";
import { bad, notFound } from "./errors";
import { receiptPdfUrl } from "./receipt-link";
import { getSale } from "./sales";
import { sendBillPdf, whatsappCloudEnabled } from "./whatsapp-cloud";

/**
 * Send a bill PDF to a WhatsApp number (POS bills and online orders).
 *  - WhatsApp Cloud API configured → delivered automatically (sent: true).
 *  - Otherwise → sent: false + a prefilled wa.me link (staff press send in WhatsApp).
 * The number is saved on the bill/customer if the bill had none.
 */
export async function sendSaleBillOnWhatsApp(db: Db, actor: Actor, saleIdOrBillNo: string, rawPhone: string) {
  const phone = cleanPhone(rawPhone);
  if (!isMobile(phone)) throw bad("Enter a valid 10-digit WhatsApp number");
  const sale = await getSale(db, saleIdOrBillNo);
  if (!sale) throw notFound("Bill not found");

  if (!sale.customer_phone) {
    await db.tx(async (q) => {
      const cid = await upsertCustomer(q, { phone, name: sale.customer_name });
      await q.query("update sales set customer_phone = $2, customer_id = coalesce(customer_id, $3) where id = $1 and customer_phone = ''", [sale.id, phone, cid]);
    });
  }

  const pdfUrl = receiptPdfUrl(sale.id);
  const b = (sale.business ?? {}) as Record<string, string>;
  const text = [
    `Hi ${sale.customer_name || "there"}, thank you for shopping at *${b.tradeName || "PowerX Nutrition"}* 💪`,
    `Bill: *${sale.bill_no}*${sale.order_id ? ` (order ${sale.order_id})` : ""}`,
    `Amount: *${inr2(sale.total)}*`,
    ``,
    `📄 Download your bill (PDF): ${pdfUrl}`,
  ].join("\n");
  const waUrl = `https://wa.me/91${phone}?text=${encodeURIComponent(text)}`;

  if (!whatsappCloudEnabled()) {
    await audit(db, actor, "sale.whatsapp_shared", { type: "sale", id: sale.id }, `Opened WhatsApp to share bill ${sale.bill_no} with ${phone}`);
    return { sent: false as const, pdfUrl, waUrl, billNo: sale.bill_no };
  }
  const r = await sendBillPdf({
    to: phone,
    pdfUrl,
    fileName: `${sale.bill_no.replace(/[^\w-]+/g, "-")}.pdf`,
    customerName: sale.customer_name || "Customer",
    billNo: sale.bill_no,
    amount: inr2(sale.total).replace("₹", "Rs. "),
  });
  await audit(db, actor, "sale.whatsapp_sent", { type: "sale", id: sale.id }, `Bill ${sale.bill_no} PDF sent on WhatsApp to ${phone}`, { messageId: r.messageId });
  return { sent: true as const, pdfUrl, waUrl, billNo: sale.bill_no, messageId: r.messageId };
}
