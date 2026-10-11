import { json, readJson, staffRoute } from "@/lib/api";
import { normalizeCode, parseCouponInput } from "@/lib/coupons";
import { audit } from "@/lib/server/audit";
import { getStore } from "@/lib/store";
import type { Coupon } from "@/types";

type P = { code: string };

/** Edit a coupon (the code itself can't change — create a new one instead). */
export const PATCH = staffRoute<P>("coupons.manage", async (req, { db, actor, params }) => {
  const code = normalizeCode(params.code);
  const store = getStore();
  const existing = await store.getCoupon(code);
  if (!existing) return json({ error: "Coupon not found" }, 404);
  const body = await readJson<Partial<Coupon>>(req);
  const [coupon, error] = parseCouponInput({ ...existing, ...body, code }, existing);
  if (!coupon) return json({ error }, 400);
  if (body.used === 0) coupon.used = 0; // "reset usage" button
  await store.saveCoupon(coupon);
  await audit(db, actor, "coupon.updated", { type: "coupon", id: code }, `Updated coupon ${code}`);
  return json({ coupon });
});

export const DELETE = staffRoute<P>("coupons.manage", async (_req, { db, actor, params }) => {
  const code = normalizeCode(params.code);
  await getStore().deleteCoupon(code);
  await audit(db, actor, "coupon.deleted", { type: "coupon", id: code }, `Deleted coupon ${code}`);
  return json({ ok: true });
});
