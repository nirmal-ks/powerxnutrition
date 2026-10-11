import { promises as fs } from "node:fs";
import path from "node:path";
import { SYSTEM_ACTOR } from "@/lib/permissions";
import type { Coupon, Order, Product, Review } from "@/types";
import type { Db, Queryable } from "./adapter";
import { newId } from "./ids";

/**
 * First start with an empty database: import the existing catalogue and history so nothing is
 * lost when moving from the JSON files (or the old Supabase px_* tables) to the new database.
 *  - products.json → products + variants; current stock becomes an OPENING movement (cost unknown)
 *  - orders.json   → orders; non-cancelled ones also become ONLINE sales (stock already deducted)
 *  - coupons.json / reviews.json → as-is
 */
async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(process.cwd(), "data", file), "utf8")) as T;
  } catch {
    return null;
  }
}

async function legacyRows<T>(q: Queryable, table: string): Promise<T[] | null> {
  const exists = await q.query<{ t: string | null }>("select to_regclass($1)::text as t", [`public.${table}`]);
  if (!exists[0]?.t) return null;
  return (await q.query<{ data: T }>(`select data from ${table}`)).map((r) => r.data);
}

export async function seedIfEmpty(db: Db, opts: { dataOverride?: { products?: Product[]; orders?: Order[] } } = {}) {
  const has = await db.query("select 1 from products limit 1");
  if (has.length) return { seeded: false };
  return db.tx(async (q) => {
    const again = await q.query("select 1 from products limit 1");
    if (again.length) return { seeded: false };
    const { addStock } = await import("@/lib/server/inventory");
    const { recordSale } = await import("@/lib/server/sales");

    const products =
      opts.dataOverride?.products ?? (await legacyRows<Product>(q, "px_products")) ?? (await readJson<Product[]>("products.json")) ?? [];
    const orders = opts.dataOverride?.orders ?? (await legacyRows<Order>(q, "px_orders")) ?? (await readJson<Order[]>("orders.json")) ?? [];
    const coupons = opts.dataOverride ? [] : ((await legacyRows<Coupon>(q, "px_coupons")) ?? (await readJson<Coupon[]>("coupons.json")) ?? []);
    const reviews = opts.dataOverride ? [] : ((await legacyRows<Review>(q, "px_reviews")) ?? (await readJson<Review[]>("reviews.json")) ?? []);

    const variantIds = new Map<string, string>();
    for (const p of products) {
      const pid = newId();
      await q.query(
        `insert into products (id, slug, name, brand, category, description, image, image_status, status, featured, sort)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) on conflict (slug) do nothing`,
        // Existing photos were chosen by the owner for the live site → keep them published (APPROVED).
        [pid, p.slug, p.name, p.brand, p.category, p.description ?? "", p.image ?? "", p.image ? "APPROVED" : "IMAGE_PENDING", p.active ? "published" : "draft", Boolean(p.featured), p.sort ?? 999],
      );
      for (const [i, v] of p.variants.entries()) {
        const vid = newId();
        await q.query(
          `insert into product_variants (id, product_id, code, label, flavour, price, mrp, stock, min_stock, sort) values ($1,$2,$3,$4,$5,$6,$7,0,$8,$9)`,
          [vid, pid, v.id, v.label, v.flavour ?? "", v.price, Math.max(v.mrp ?? v.price, v.price), 2, i],
        );
        variantIds.set(`${p.slug}|${v.id}`, vid);
        if (v.stock > 0) {
          await addStock(q, { variantId: vid, qty: v.stock, type: "OPENING", refType: "opening", refId: vid, actor: SYSTEM_ACTOR, note: "Opening stock imported from the previous catalogue" });
        }
      }
    }

    for (const o of orders) {
      await q.query(
        `insert into orders (id, data, status, payment_status, phone, total, stock_deducted, created_at) values ($1,$2,$3,$4,$5,$6,$7,$8) on conflict (id) do nothing`,
        [o.id, JSON.stringify(o), o.status, o.paymentStatus, o.customer?.phone ?? null, o.total, o.status !== "cancelled", o.createdAt],
      );
      if (o.status === "cancelled") continue;
      const items = o.items
        .map((i) => ({ variantId: variantIds.get(`${i.slug}|${i.variantId}`)!, qty: i.qty, unitPrice: i.price }))
        .filter((i) => i.variantId);
      if (!items.length) continue;
      const sale = await recordSale(q, SYSTEM_ACTOR, {
        channel: "ONLINE",
        items,
        discountPaise: Math.round((o.discount ?? 0) * 100),
        deliveryPaise: Math.round((o.delivery ?? 0) * 100),
        customer: { name: o.customer?.name, phone: o.customer?.phone, email: o.customer?.email },
        orderId: o.id,
        payments: "auto",
        paymentStatus: o.paymentStatus === "paid" ? "paid" : "unpaid",
        skipStock: true, // the old system already reduced stock for these orders
        createdAt: o.createdAt,
        forceInclusive: true,
        notes: `Imported order ${o.id}`,
      });
      await q.query("update orders set sale_id = $2 where id = $1", [o.id, sale.id]);
    }

    for (const c of coupons) {
      await q.query("insert into coupons (code, data, active, created_at) values ($1,$2,$3,$4) on conflict (code) do nothing", [c.code, JSON.stringify(c), c.active, c.createdAt]);
    }
    for (const r of reviews) {
      await q.query("insert into reviews (id, data, slug, status, rating, created_at) values ($1,$2,$3,$4,$5,$6) on conflict (id) do nothing", [
        r.id,
        JSON.stringify(r),
        r.slug,
        r.status,
        r.rating,
        r.createdAt,
      ]);
    }
    await q.query(
      `insert into audit_logs (user_id, user_name, role, action, entity_type, entity_id, summary) values ('system','System','owner','system.seeded','database','',$1)`,
      [`Imported ${products.length} products, ${orders.length} orders, ${coupons.length} coupons, ${reviews.length} reviews`],
    );
    return { seeded: true, products: products.length, orders: orders.length };
  });
}
