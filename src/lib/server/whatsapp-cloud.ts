/**
 * OPTIONAL fully-automatic WhatsApp sending through Meta's official WhatsApp Business Cloud API.
 * When configured, the bill PDF is delivered to the customer's WhatsApp with no tap needed.
 * Without it, the app uses free wa.me links (WhatsApp opens with the message + PDF link ready).
 *
 * Setup (see README → "WhatsApp bill PDF"): a Meta Business app, a WhatsApp phone number
 * (not used in the normal WhatsApp app), a permanent access token and an APPROVED message
 * template with a DOCUMENT header and 3 body variables: {{1}} name, {{2}} bill no, {{3}} amount.
 * Meta charges a small fee per business-initiated (template) message.
 */
export const whatsappCloudEnabled = () =>
  Boolean(process.env.WHATSAPP_CLOUD_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_BILL_TEMPLATE);

export interface SendBillInput {
  to: string; // 10-digit Indian mobile
  pdfUrl: string; // must be a public https URL Meta can download
  fileName: string;
  customerName: string;
  billNo: string;
  amount: string;
}

export async function sendBillPdf(input: SendBillInput, fetchImpl: typeof fetch = fetch): Promise<{ messageId: string }> {
  if (!whatsappCloudEnabled()) throw new Error("WhatsApp Cloud API is not configured");
  if (!/^https:\/\//.test(input.pdfUrl)) throw new Error("NEXT_PUBLIC_SITE_URL must be your public https website for WhatsApp to fetch the PDF");
  const version = process.env.WHATSAPP_API_VERSION || "v21.0";
  const res = await fetchImpl(`https://graph.facebook.com/${version}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_CLOUD_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: `91${input.to}`,
      type: "template",
      template: {
        name: process.env.WHATSAPP_BILL_TEMPLATE,
        language: { code: process.env.WHATSAPP_TEMPLATE_LANG || "en" },
        components: [
          { type: "header", parameters: [{ type: "document", document: { link: input.pdfUrl, filename: input.fileName } }] },
          {
            type: "body",
            parameters: [
              { type: "text", text: input.customerName || "Customer" },
              { type: "text", text: input.billNo },
              { type: "text", text: input.amount },
            ],
          },
        ],
      },
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string } };
  if (!res.ok || !data.messages?.[0]?.id) throw new Error(`WhatsApp didn't accept the message: ${data.error?.message ?? res.status}`);
  return { messageId: data.messages[0].id };
}
