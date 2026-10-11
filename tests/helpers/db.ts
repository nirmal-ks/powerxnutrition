import { createPgliteDb, type Db } from "@/lib/db/adapter";
import { migrate } from "@/lib/db";
import { seedIfEmpty } from "@/lib/db/seed";
import type { Actor } from "@/lib/permissions";
import type { Product } from "@/types";

export const OWNER: Actor = { id: "owner", name: "Owner", role: "owner" };
export const MANAGER: Actor = { id: "mgr", name: "Manager", role: "manager" };
export const CASHIER: Actor = { id: "cash1", name: "Cashier", role: "cashier" };
export const STOCK: Actor = { id: "inv1", name: "Stock staff", role: "inventory" };

export const sampleProducts: Product[] = [
  {
    slug: "on-gold-whey",
    name: "ON Gold Standard 100% Whey",
    brand: "Optimum Nutrition",
    category: "whey-protein",
    description: "",
    image: "/products/on.jpg",
    featured: true,
    active: true,
    sort: 1,
    variants: [
      { id: "1-kg", label: "1 kg", price: 3500, mrp: 4000, stock: 20 },
      { id: "2-kg", label: "2 kg", price: 6500, mrp: 7000, stock: 5 },
    ],
  },
  {
    slug: "mb-creatine",
    name: "MuscleBlaze Creatine Monohydrate",
    brand: "MuscleBlaze",
    category: "creatine",
    description: "",
    image: "",
    featured: false,
    active: true,
    sort: 2,
    variants: [{ id: "250-g", label: "250 g", price: 799, mrp: 999, stock: 3 }],
  },
];

/** Fresh in-memory Postgres with all migrations and a small seeded catalogue. */
export async function testDb(): Promise<Db> {
  const db = await createPgliteDb();
  await migrate(db);
  await seedIfEmpty(db, { dataOverride: { products: sampleProducts, orders: [] } });
  return db;
}

export async function variantId(db: Db, slug: string, code: string) {
  const r = await db.query<{ id: string }>(
    "select v.id from product_variants v join products p on p.id = v.product_id where p.slug = $1 and v.code = $2",
    [slug, code],
  );
  return r[0].id;
}

export async function stockOf(db: Db, id: string) {
  return (await db.query<{ stock: number }>("select stock from product_variants where id = $1", [id]))[0].stock;
}

export async function movementCount(db: Db, where = "true", params: unknown[] = []) {
  return (await db.query<{ n: number }>(`select count(*)::int as n from inventory_movements where ${where}`, params))[0].n;
}

export const txnId = () => crypto.randomUUID();
