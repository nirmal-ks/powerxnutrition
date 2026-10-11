import type { Coupon, Order, Product, Review } from "@/types";

/**
 * Storage driver contract. Today there are two drivers:
 *  - file:     JSON files in /data (zero setup, great locally / on any Node host with a disk)
 *  - supabase: free hosted Postgres (needed on Vercel so admin edits & orders persist)
 * To move to another backend (MongoDB, MySQL, your own API…) implement this interface
 * and return it from getStore() in ./index.ts — no page or component needs to change.
 */
export interface Store {
  kind: "file" | "supabase" | "database";

  listProducts(opts?: { fresh?: boolean }): Promise<Product[]>;
  getProduct(slug: string): Promise<Product | null>;
  /** Create or replace. If originalSlug differs from product.slug the old record is removed. */
  saveProduct(product: Product, originalSlug?: string): Promise<void>;
  deleteProduct(slug: string): Promise<void>;

  listOrders(): Promise<Order[]>;
  getOrder(id: string): Promise<Order | null>;
  createOrder(order: Order): Promise<void>;
  updateOrder(id: string, patch: Partial<Order>): Promise<Order | null>;

  listCoupons(): Promise<Coupon[]>;
  getCoupon(code: string): Promise<Coupon | null>;
  /** Create or replace by code. */
  saveCoupon(coupon: Coupon): Promise<void>;
  deleteCoupon(code: string): Promise<void>;

  /** All reviews, newest first; pass a slug to get one product's reviews. */
  listReviews(opts?: { slug?: string }): Promise<Review[]>;
  createReview(review: Review): Promise<void>;
  updateReview(id: string, patch: Partial<Review>): Promise<Review | null>;
  deleteReview(id: string): Promise<void>;

  /** Stores an uploaded product image and returns its public URL/path. */
  uploadImage(name: string, contentType: string, bytes: ArrayBuffer): Promise<string>;
}

export class StoreError extends Error {
  /** `extra` is sent to the client with the error (e.g. similar suppliers, the correct total). */
  constructor(message: string, public status = 500, public extra?: Record<string, unknown>) {
    super(message);
  }
}
