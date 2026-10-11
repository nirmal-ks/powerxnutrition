import { json, readJson, staffRoute } from "@/lib/api";
import { adjustStock, type AdjustReason } from "@/lib/server/inventory";
import { revalidateStore } from "@/lib/server/revalidate";
import { getSettings } from "@/lib/server/settings";

/** Manual stock correction (count correction, damage, expiry…) — owner/manager only, reason required, audited. */
export const POST = staffRoute("inventory.adjust", async (req, { db, actor }) => {
  const b = await readJson<{ variantId: string; change: number; reason: AdjustReason; note?: string; batchId?: string; clientTxnId?: string }>(req);
  await db.tx(async (q) => {
    const s = await getSettings(q);
    await adjustStock(q, actor, b, s.operations.allowNegativeStock);
  });
  revalidateStore();
  const row = await db.query<{ stock: number }>("select stock from product_variants where id = $1", [b.variantId]);
  return json({ ok: true, stock: row[0]?.stock });
});
