import "server-only";
import { getDb } from "@/lib/db";
import { SYSTEM_ACTOR } from "@/lib/permissions";
import * as orders from "@/lib/server/orders";
import * as products from "@/lib/server/products";
import { savePublicImage } from "@/lib/server/storage";
import type { Coupon, Order, Review } from "@/types";
import type { Store } from "./types";

/**
 * The Store interface (used by storefront pages, coupons, reviews) backed by the new Postgres
 * database. Stock-changing operations do NOT go through here any more — they use the inventory
 * engine in src/lib/server with a staff actor and a transaction.
 */
export const sqlStore: Store = {
  kind: "database",

  async listProducts() {
    return products.listProducts(await getDb());
  },
  async getProduct(slug) {
    return products.getProduct(await getDb(), slug);
  },
  async saveProduct(product, originalSlug) {
    const db = await getDb();
    await db.tx((q) => products.saveProduct(q, SYSTEM_ACTOR, product, originalSlug));
  },
  async deleteProduct(slug) {
    const db = await getDb();
    await db.tx((q) => products.deleteProduct(q, SYSTEM_ACTOR, slug));
  },

  async listOrders() {
    return orders.listOrders(await getDb());
  },
  async getOrder(id) {
    return orders.getOrder(await getDb(), id);
  },
  async createOrder() {
    throw new Error("Use createOrder() from src/lib/server/orders (transactional)");
  },
  async updateOrder(id, patch: Partial<Order>) {
    const db = await getDb();
    return db.tx((q) => orders.updateOrder(q, SYSTEM_ACTOR, id, patch));
  },

  async listCoupons() {
    const db = await getDb();
    return (await db.query<{ data: Coupon }>("select data from coupons order by created_at desc")).map((r) => r.data);
  },
  async getCoupon(code) {
    const db = await getDb();
    return (await db.query<{ data: Coupon }>("select data from coupons where code = $1", [code]))[0]?.data ?? null;
  },
  async saveCoupon(c) {
    const db = await getDb();
    await db.query(
      `insert into coupons (code, data, active, created_at) values ($1,$2,$3,$4)
       on conflict (code) do update set data = excluded.data, active = excluded.active`,
      [c.code, JSON.stringify(c), c.active, c.createdAt],
    );
  },
  async deleteCoupon(code) {
    const db = await getDb();
    await db.query("delete from coupons where code = $1", [code]);
  },

  async listReviews(opts) {
    const db = await getDb();
    const rows = opts?.slug
      ? await db.query<{ data: Review }>("select data from reviews where slug = $1 order by created_at desc", [opts.slug])
      : await db.query<{ data: Review }>("select data from reviews order by created_at desc limit 2000");
    return rows.map((r) => r.data);
  },
  async createReview(r) {
    const db = await getDb();
    await db.query("insert into reviews (id, data, slug, status, rating, created_at) values ($1,$2,$3,$4,$5,$6)", [r.id, JSON.stringify(r), r.slug, r.status, r.rating, r.createdAt]);
  },
  async updateReview(id, patch) {
    const db = await getDb();
    return db.tx(async (q) => {
      const cur = (await q.query<{ data: Review }>("select data from reviews where id = $1 for update", [id]))[0]?.data;
      if (!cur) return null;
      const next = { ...cur, ...patch, id };
      await q.query("update reviews set data = $2, status = $3, rating = $4 where id = $1", [id, JSON.stringify(next), next.status, next.rating]);
      return next;
    });
  },
  async deleteReview(id) {
    const db = await getDb();
    await db.query("delete from reviews where id = $1", [id]);
  },

  async uploadImage(name, _contentType, bytes) {
    return savePublicImage(name.replace(/\.[^.]+$/, ""), Buffer.from(bytes));
  },
};
