import { json, readJson, staffRoute } from "@/lib/api";
import { can } from "@/lib/permissions";
import type { AllSettings } from "@/lib/settings-types";
import { forbidden } from "@/lib/server/errors";
import { googleConfigured } from "@/lib/server/images";
import { aiProvider } from "@/lib/server/invoice-extract";
import { razorpayEnabled } from "@/lib/server/razorpay";
import { getSettings, saveSettings } from "@/lib/server/settings";
import { storageKind } from "@/lib/server/storage";
import { dbKind } from "@/lib/db";

export const GET = staffRoute(null, async (_req, { db }) => {
  const p = aiProvider();
  return json({
    settings: await getSettings(db),
    integrations: {
      database: dbKind(),
      storage: storageKind(),
      ai: p ? { label: p.label, external: p.external } : null,
      googleImages: googleConfigured(),
      razorpay: razorpayEnabled(),
      razorpayWebhook: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET),
    },
  });
});

/** { group: "business" | "operations" | "ai", values } — business (GST/tax) needs tax.manage, others settings.manage. */
export const PUT = staffRoute(["settings.manage", "tax.manage"], async (req, { db, actor }) => {
  const body = await readJson<{ group: keyof AllSettings; values: Record<string, unknown> }>(req);
  if (!["business", "operations", "ai"].includes(body.group)) return json({ error: "Unknown settings group" }, 400);
  if (body.group === "business" && !can(actor.role, "tax.manage")) throw forbidden("Only the owner can change business & tax settings");
  if (body.group !== "business" && !can(actor.role, "settings.manage")) throw forbidden();
  const saved = await db.tx((q) => saveSettings(q, actor, body.group, body.values as never));
  return json({ saved });
});
