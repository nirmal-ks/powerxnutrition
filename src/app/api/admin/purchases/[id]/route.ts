import { json, readJson, staffRoute } from "@/lib/api";
import { can } from "@/lib/permissions";
import { revalidateStore } from "@/lib/server/revalidate";
import { cancelDraft, confirmPurchase, getPurchase, recordSupplierPayment, savePurchaseDraft, type PurchaseInput } from "@/lib/server/purchases";
import { forbidden } from "@/lib/server/errors";

type P = { id: string };

export const GET = staffRoute<P>("purchases.create", async (_req, { db, params }) => {
  const p = await getPurchase(db, params.id);
  return p ? json({ purchase: p }) : json({ error: "Purchase not found" }, 404);
});

/** Edit a draft. */
export const PUT = staffRoute<P>("purchases.create", async (req, { db, actor, params }) => {
  const body = await readJson<PurchaseInput>(req);
  const purchase = await db.tx((q) => savePurchaseDraft(q, actor, body, params.id));
  return json({ purchase });
});

/** Actions: { action: "confirm", overrideDuplicateReason? } | { action: "cancel" } | { action: "payment", amount } */
export const POST = staffRoute<P>("purchases.create", async (req, { db, actor, params }) => {
  const body = await readJson<{ action: string; overrideDuplicateReason?: string; amount?: number }>(req);
  if (body.action === "confirm") {
    if (!can(actor.role, "purchases.confirm")) throw forbidden();
    const r = await db.tx((q) => confirmPurchase(q, actor, params.id, { overrideDuplicateReason: body.overrideDuplicateReason }));
    if (!r.duplicate) revalidateStore();
    return json(r);
  }
  if (body.action === "cancel") {
    await db.tx((q) => cancelDraft(q, actor, params.id));
    return json({ ok: true });
  }
  if (body.action === "payment") {
    await db.tx((q) => recordSupplierPayment(q, actor, params.id, Number(body.amount)));
    return json({ purchase: await getPurchase(db, params.id) });
  }
  return json({ error: "Unknown action" }, 400);
});
