import { json, readJson, staffRoute } from "@/lib/api";
import { inr2 } from "@/lib/money";
import { audit } from "@/lib/server/audit";
import { cleanPhone, isMobile, upsertCustomer } from "@/lib/server/customers";
import { bad, notFound } from "@/lib/server/errors";
import { receiptPdfUrl } from "@/lib/server/receipt-link";
import { getSale } from "@/lib/server/sales";
import { sendBillPdf, whatsappCloudEnabled } from "@/lib/server/whatsapp-cloud";

/**
 * Send the bill PDF to a WhatsApp number.
 *  - WhatsApp Cloud API configured → the PDF is delivered automatically (sent: true).
 *  - Otherwise → sent: false; the page opens WhatsApp with the message + PDF link (staff press send).
 * The number is saved on the bill/customer if the bill had none.
 */
export const POST = staffRoute<{ id: string }>("sales.view", async (req, { db, actor, params }) => {
  const { phone: raw } = await readJson<{ phone?: string }>(req);
  const phone = cleanPhone(raw);
  if (!isMobile(phone)) throw bad("Enter a valid 10-digit WhatsApp number");
  const sale = await getSale(db, params.id);
  if (!sale) throw notFound("Bill not found");

  if (!sale.customer_phone) {
    await db.tx(async (q) => {
      const cid = await upsertCustomer(q, { phone, name: sale.customer_name });
      await q.query("update sales set customer_phone = $2, customer_id = coalesce(customer_id, $3) where id = $1 and customer_phone = ''", [sale.id, phone, cid]);
    });
  }

  const pdfUrl = receiptPdfUrl(sale.id);
  if (!whatsappCloudEnabled()) {
    await audit(db, actor, "sale.whatsapp_shared", { type: "sale", id: sale.id }, `Opened WhatsApp to share bill ${sale.bill_no} with ${phone}`);
    return json({ sent: false, pdfUrl });
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
  return json({ sent: true, messageId: r.messageId, pdfUrl });
});
