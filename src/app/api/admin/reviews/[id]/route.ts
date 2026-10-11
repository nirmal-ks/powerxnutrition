import { revalidatePath } from "next/cache";
import { json, readJson, staffRoute } from "@/lib/api";
import { productUrl } from "@/lib/catalog";
import { getStore } from "@/lib/store";
import type { Review, ReviewStatus } from "@/types";

type P = { id: string };
const STATUSES: ReviewStatus[] = ["pending", "approved", "rejected"];

/** Approve / reject a review, or add the shop's public reply. */
export const PATCH = staffRoute<P>("reviews.manage", async (req, { params }) => {
  const body = await readJson<Partial<Review>>(req);
  const patch: Partial<Review> = {};
  if (body.status && STATUSES.includes(body.status)) patch.status = body.status;
  if (typeof body.reply === "string") patch.reply = body.reply.trim().slice(0, 600) || undefined;
  const review = await getStore().updateReview(params.id, patch);
  if (!review) return json({ error: "Review not found" }, 404);
  revalidatePath(productUrl(review.slug));
  return json({ review });
});

export const DELETE = staffRoute<P>("reviews.manage", async (_req, { params }) => {
  const store = getStore();
  const review = (await store.listReviews()).find((r) => r.id === params.id);
  await store.deleteReview(params.id);
  if (review) revalidatePath(productUrl(review.slug));
  return json({ ok: true });
});
