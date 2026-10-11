import { json, readJson, searchParams, staffRoute } from "@/lib/api";
import { revalidateStore } from "@/lib/server/revalidate";
import { confirmPurchase, listPurchases, savePurchaseDraft, type PurchaseInput } from "@/lib/server/purchases";

export const GET = staffRoute("purchases.create", async (req, { db }) => {
  const sp = searchParams(req);
  return json({
    purchases: await listPurchases(db, {
      status: sp.get("status") ?? undefined,
      supplierId: sp.get("supplier") ?? undefined,
      from: sp.get("from") ?? undefined,
      to: sp.get("to") ?? undefined,
      search: sp.get("q") ?? undefined,
    }),
  });
});

/**
 * Saves a draft (no stock change). With { confirm: true } the draft is also confirmed in the same
 * transaction (stock goes up once) — used by the quick mobile stock-in form.
 */
export const POST = staffRoute("purchases.create", async (req, { db, actor }) => {
  const body = await readJson<PurchaseInput & { confirm?: boolean; overrideDuplicateReason?: string }>(req);
  const result = await db.tx(async (q) => {
    const draft = await savePurchaseDraft(q, actor, body);
    if (!body.confirm) return { purchase: draft, confirmed: false };
    const r = await confirmPurchase(q, actor, draft.id, { overrideDuplicateReason: body.overrideDuplicateReason });
    return { purchase: r.purchase, confirmed: true };
  });
  if (result.confirmed) revalidateStore();
  return json(result, 201);
});
