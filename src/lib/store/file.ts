import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Coupon, Order, Product, Review } from "@/types";
import { StoreError, type Store } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const PRODUCTS = path.join(DATA_DIR, "products.json");
const ORDERS = path.join(DATA_DIR, "orders.json");
const COUPONS = path.join(DATA_DIR, "coupons.json");
const REVIEWS = path.join(DATA_DIR, "reviews.json");
const UPLOADS = path.join(process.cwd(), "public", "uploads");

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw e;
  }
}

// Serialise writes so two quick requests can't clobber each other.
let queue: Promise<unknown> = Promise.resolve();
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

async function writeJson(file: string, data: unknown) {
  try {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2) + "\n");
    await fs.rename(tmp, file);
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "EROFS" || code === "EACCES" || code === "EPERM") {
      throw new StoreError(
        "This host has a read-only file system (e.g. Vercel). Connect the free Supabase database (see README) to save changes.",
        503,
      );
    }
    throw e;
  }
}

export const fileStore: Store = {
  kind: "file",

  async listProducts() {
    const list = await readJson<Product[]>(PRODUCTS, []);
    return list.sort((a, b) => a.sort - b.sort);
  },
  async getProduct(slug) {
    return (await this.listProducts()).find((p) => p.slug === slug) ?? null;
  },
  saveProduct(product, originalSlug) {
    return locked(async () => {
      const list = await readJson<Product[]>(PRODUCTS, []);
      const key = originalSlug ?? product.slug;
      const idx = list.findIndex((p) => p.slug === key);
      if (idx >= 0) list[idx] = product;
      else list.push(product);
      await writeJson(PRODUCTS, list);
    });
  },
  deleteProduct(slug) {
    return locked(async () => {
      const list = await readJson<Product[]>(PRODUCTS, []);
      await writeJson(PRODUCTS, list.filter((p) => p.slug !== slug));
    });
  },

  async listOrders() {
    const list = await readJson<Order[]>(ORDERS, []);
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async getOrder(id) {
    return (await readJson<Order[]>(ORDERS, [])).find((o) => o.id === id) ?? null;
  },
  createOrder(order) {
    return locked(async () => {
      const list = await readJson<Order[]>(ORDERS, []);
      list.push(order);
      await writeJson(ORDERS, list);
    });
  },
  updateOrder(id, patch) {
    return locked(async () => {
      const list = await readJson<Order[]>(ORDERS, []);
      const idx = list.findIndex((o) => o.id === id);
      if (idx < 0) return null;
      list[idx] = { ...list[idx], ...patch, id };
      await writeJson(ORDERS, list);
      return list[idx];
    });
  },

  async listCoupons() {
    const list = await readJson<Coupon[]>(COUPONS, []);
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async getCoupon(code) {
    return (await readJson<Coupon[]>(COUPONS, [])).find((c) => c.code === code) ?? null;
  },
  saveCoupon(coupon) {
    return locked(async () => {
      const list = await readJson<Coupon[]>(COUPONS, []);
      const idx = list.findIndex((c) => c.code === coupon.code);
      if (idx >= 0) list[idx] = coupon;
      else list.push(coupon);
      await writeJson(COUPONS, list);
    });
  },
  deleteCoupon(code) {
    return locked(async () => {
      const list = await readJson<Coupon[]>(COUPONS, []);
      await writeJson(COUPONS, list.filter((c) => c.code !== code));
    });
  },

  async listReviews(opts) {
    const list = await readJson<Review[]>(REVIEWS, []);
    return list.filter((r) => !opts?.slug || r.slug === opts.slug).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  createReview(review) {
    return locked(async () => {
      const list = await readJson<Review[]>(REVIEWS, []);
      list.push(review);
      await writeJson(REVIEWS, list);
    });
  },
  updateReview(id, patch) {
    return locked(async () => {
      const list = await readJson<Review[]>(REVIEWS, []);
      const idx = list.findIndex((r) => r.id === id);
      if (idx < 0) return null;
      list[idx] = { ...list[idx], ...patch, id };
      await writeJson(REVIEWS, list);
      return list[idx];
    });
  },
  deleteReview(id) {
    return locked(async () => {
      const list = await readJson<Review[]>(REVIEWS, []);
      await writeJson(REVIEWS, list.filter((r) => r.id !== id));
    });
  },

  async uploadImage(name, _contentType, bytes) {
    try {
      await fs.mkdir(UPLOADS, { recursive: true });
      await fs.writeFile(path.join(UPLOADS, name), Buffer.from(bytes));
    } catch {
      throw new StoreError("Can't save files on this host. Connect Supabase (see README) or paste an image URL instead.", 503);
    }
    return `/uploads/${name}`;
  },
};
