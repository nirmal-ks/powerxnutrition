import { json } from "@/lib/api";
import { getDb } from "@/lib/db";
import { handleWebhook, verifyWebhookSignature } from "@/lib/server/razorpay";

/**
 * Razorpay webhook (Dashboard → Settings → Webhooks → URL: https://<your-domain>/api/payments/razorpay/webhook,
 * events: payment.captured, payment.failed, order.paid; secret = RAZORPAY_WEBHOOK_SECRET).
 * Signature is verified on the raw body; repeated deliveries are harmless (idempotent).
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyWebhookSignature(raw, req.headers.get("x-razorpay-signature") ?? "")) return json({ error: "Invalid signature" }, 401);
  try {
    const result = await handleWebhook(await getDb(), JSON.parse(raw));
    return json({ ok: true, ...result });
  } catch (e) {
    console.error("[razorpay webhook]", e);
    // 5xx makes Razorpay retry later; 4xx business errors are acknowledged to stop retries
    return json({ ok: false, error: (e as Error).message }, (e as { status?: number }).status && (e as { status: number }).status < 500 ? 200 : 500);
  }
}
