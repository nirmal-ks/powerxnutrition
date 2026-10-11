import { errorResponse, json } from "@/lib/api";
import { evaluateCoupon, listCheckoutOffers, toPublicCoupon } from "@/lib/coupons";

/** Offers shown at checkout. */
export async function GET() {
  try {
    return json({ offers: await listCheckoutOffers() });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Checks a code for the current cart. The order API re-checks it with server prices. */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { code?: string; subtotal?: number; phone?: string };
    const { coupon, discount } = await evaluateCoupon(body.code, Math.max(0, Number(body.subtotal) || 0), body.phone);
    return json({ coupon: toPublicCoupon(coupon), discount });
  } catch (e) {
    return errorResponse(e);
  }
}
