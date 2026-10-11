import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/adapter";
import { buildReceiptPdf } from "@/lib/server/receipt-pdf";
import { createPosSale } from "@/lib/server/sales";
import { sendBillPdf, whatsappCloudEnabled } from "@/lib/server/whatsapp-cloud";
import { CASHIER, testDb, txnId, variantId } from "./helpers/db";

let db: Db;
beforeAll(async () => {
  db = await testDb();
});
afterEach(() => {
  delete process.env.WHATSAPP_CLOUD_TOKEN;
  delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  delete process.env.WHATSAPP_BILL_TEMPLATE;
});
afterAll(() => db.close());

describe("bill PDF + WhatsApp", () => {
  it("builds a real PDF of the bill", async () => {
    const vid = await variantId(db, "on-gold-whey", "1-kg");
    const { sale } = await createPosSale(db, CASHIER, { clientTxnId: txnId(), items: [{ variantId: vid, qty: 2 }], payments: [{ method: "upi", amount: 7000, reference: "UTR123" }], customer: { name: "Ravi", phone: "9876543210" } });
    const pdf = Buffer.from(await buildReceiptPdf(sale));
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1000);
  });

  it("is off unless the WhatsApp Cloud API is configured (free wa.me mode is used)", () => {
    expect(whatsappCloudEnabled()).toBe(false);
  });

  it("sends the PDF as a document template to +91 number when configured", async () => {
    process.env.WHATSAPP_CLOUD_TOKEN = "tok";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123";
    process.env.WHATSAPP_BILL_TEMPLATE = "bill_pdf";
    let sent: { url: string; body: Record<string, unknown> } | null = null;
    const fake = (async (url: string, init: RequestInit) => {
      sent = { url, body: JSON.parse(String(init.body)) };
      return new Response(JSON.stringify({ messages: [{ id: "wamid.1" }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const r = await sendBillPdf({ to: "9876543210", pdfUrl: "https://shop.example/r/x/pdf?t=1", fileName: "PXR-26-27-00001.pdf", customerName: "Ravi", billNo: "PXR/26-27/00001", amount: "Rs. 7,000" }, fake);
    expect(r.messageId).toBe("wamid.1");
    expect(sent!.url).toContain("/123/messages");
    const body = sent!.body as { to: string; template: { name: string; components: { type: string; parameters: { document?: { link: string } }[] }[] } };
    expect(body.to).toBe("919876543210");
    expect(body.template.name).toBe("bill_pdf");
    expect(body.template.components[0].parameters[0].document!.link).toBe("https://shop.example/r/x/pdf?t=1");
  });

  it("refuses a non-public PDF link (WhatsApp couldn't download it)", async () => {
    process.env.WHATSAPP_CLOUD_TOKEN = "tok";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123";
    process.env.WHATSAPP_BILL_TEMPLATE = "bill_pdf";
    await expect(sendBillPdf({ to: "9876543210", pdfUrl: "http://localhost:3000/r/x/pdf", fileName: "a.pdf", customerName: "", billNo: "1", amount: "1" })).rejects.toThrow(/public https/);
  });
});
