import "server-only";
import { randomBytes } from "node:crypto";
import type { PublicReview, RatingSummary, Review } from "@/types";
import { getCatalogProduct, getStore, StoreError } from "./store";

export const publicReview = ({ phone: _p, status: _s, ...rest }: Review): PublicReview => rest;

export function summarize(reviews: Pick<Review, "rating">[]): RatingSummary {
  const stars: RatingSummary["stars"] = [0, 0, 0, 0, 0];
  for (const r of reviews) stars[5 - r.rating]++;
  const count = reviews.length;
  const average = count ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10 : 0;
  return { average, count, stars };
}

/** Approved reviews for a product page. Never throws — a broken review store must not break the page. */
export async function getProductReviews(slug: string) {
  try {
    const approved = (await getStore().listReviews({ slug })).filter((r) => r.status === "approved");
    return { reviews: approved.map(publicReview), summary: summarize(approved) };
  } catch (e) {
    console.error("[reviews] read failed", e);
    return { reviews: [], summary: summarize([]) };
  }
}

// Very small in-memory rate limit: 3 saved reviews per IP per hour (per server instance).
const hits = new Map<string, number[]>();
const recentHits = (ip: string) => (hits.get(ip) ?? []).filter((t) => Date.now() - t < 3600_000);
function checkRateLimit(ip: string) {
  if (recentHits(ip).length >= 3) throw new StoreError("You've sent a few reviews already — please try again in a while.", 429);
}
const recordHit = (ip: string) => hits.set(ip, [...recentHits(ip), Date.now()]);

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");

export interface ReviewInput {
  slug?: string;
  name?: string;
  rating?: number;
  title?: string;
  text?: string;
  phone?: string;
  /** honeypot — real people leave it empty */
  website?: string;
}

/** Saves a customer's review as "pending" until the shop approves it. */
export async function submitReview(input: ReviewInput, ip: string) {
  if (input.website) throw new StoreError("Thanks!", 200); // quietly drop bots
  const slug = clean(input.slug, 120);
  const name = clean(input.name, 40);
  const rating = Math.round(Number(input.rating));
  const title = clean(input.title, 80);
  const text = typeof input.text === "string" ? input.text.trim().slice(0, 1000) : "";
  const phone = clean(input.phone, 20).replace(/\D/g, "").slice(-10);

  if (!(await getCatalogProduct(slug))) throw new StoreError("Product not found", 404);
  if (name.length < 2) throw new StoreError("Enter your name", 400);
  if (!(rating >= 1 && rating <= 5)) throw new StoreError("Tap the stars to rate the product", 400);
  if (text.length < 10) throw new StoreError("Write at least a few words (10+ characters)", 400);
  if (phone && !/^[6-9]\d{9}$/.test(phone)) throw new StoreError("Enter a valid 10-digit mobile number, or leave it empty", 400);
  checkRateLimit(ip);

  const store = getStore();
  if (phone) {
    const mine = (await store.listReviews({ slug })).find((r) => r.phone === phone && r.status !== "rejected");
    if (mine) throw new StoreError("You've already reviewed this product — thank you!", 409);
  }
  const verified = phone
    ? (await store.listOrders()).some((o) => o.customer.phone === phone && o.status !== "cancelled" && o.items.some((i) => i.slug === slug))
    : false;

  const review: Review = {
    id: `r_${Date.now().toString(36)}${randomBytes(3).toString("hex")}`,
    slug,
    name,
    rating,
    title: title || undefined,
    text,
    createdAt: new Date().toISOString(),
    status: "pending",
    verified,
    phone: phone || undefined,
  };
  await store.createReview(review);
  recordHit(ip);
  return review;
}
