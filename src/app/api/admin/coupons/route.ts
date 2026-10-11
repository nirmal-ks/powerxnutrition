import { json, readJson, staffRoute } from "@/lib/api";
import { parseCouponInput } from "@/lib/coupons";
import { audit } from "@/lib/server/audit";
import { getStore } from "@/lib/store";
import type { Coupon } from "@/types";

export const GET = staffRoute("coupons.manage", async () => json({ coupons: await getStore().listCoupons() }));

export const POST = staffRoute("coupons.manage", async (req, { db, actor }) => {
  const [coupon, error] = parseCouponInput(await readJson<Partial<Coupon>>(req));
  if (!coupon) return json({ error }, 400);
  const store = getStore();
  if (await store.getCoupon(coupon.code)) return json({ error: `Coupon “${coupon.code}” already exists` }, 409);
  await store.saveCoupon(coupon);
  await audit(db, actor, "coupon.created", { type: "coupon", id: coupon.code }, `Created coupon ${coupon.code} (${coupon.type === "percent" ? `${coupon.value}%` : `₹${coupon.value}`})`);
  return json({ coupon }, 201);
});
