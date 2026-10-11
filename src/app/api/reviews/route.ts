import { errorResponse, json } from "@/lib/api";
import { type ReviewInput, submitReview } from "@/lib/reviews";

/** A customer submits a review; it shows on the site after the shop approves it. */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as ReviewInput;
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
    const review = await submitReview(body, ip);
    return json({ ok: true, verified: review.verified }, 201);
  } catch (e) {
    return errorResponse(e);
  }
}
