import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { dbKind, isBuildPhase } from "@/lib/db";
import type { Product } from "@/types";
import { fileStore } from "./file";
import { sqlStore } from "./sql";
import type { Store } from "./types";

export { StoreError } from "./types";
export type { Store } from "./types";

/**
 * All data now lives in the Postgres database (PGlite locally, or DATABASE_URL in production) so
 * the website, POS, inventory and reports share ONE source of truth. The JSON file driver stays
 * only as a read-only fallback so the shop never goes blank.
 */
export function getStore(): Store {
  return sqlStore;
}

const SNAPSHOT = () => path.join(process.cwd(), "data", "catalog-snapshot.json");

/** Strips admin-only fields (purchase cost, ids) before products reach the storefront. */
const toPublic = (p: Product): Product => ({
  slug: p.slug,
  name: p.name,
  brand: p.brand,
  category: p.category,
  description: p.description,
  image: p.image,
  featured: p.featured,
  active: p.active,
  sort: p.sort,
  variants: p.variants.map((v) => ({ id: v.id, label: v.label, flavour: v.flavour ?? "", price: v.price, mrp: v.mrp, stock: v.stock })),
});

/** Written after catalogue/stock changes so `next build` can prerender without opening PGlite. */
export async function writeCatalogSnapshot(products: Product[]) {
  if (dbKind() !== "pglite") return;
  try {
    await fs.writeFile(SNAPSHOT(), JSON.stringify(products.filter((p) => p.active).map(toPublic)));
  } catch {
    /* read-only host: ignore */
  }
}

/**
 * Published products for the storefront. Prerendered pages are revalidated whenever stock or
 * products change (see revalidateStore), and checkout always re-checks live stock.
 */
export async function getCatalog(): Promise<Product[]> {
  if (isBuildPhase() && dbKind() === "pglite") {
    try {
      return JSON.parse(await fs.readFile(SNAPSHOT(), "utf8")) as Product[];
    } catch {
      return (await fileStore.listProducts()).filter((p) => p.active).map(toPublic);
    }
  }
  let list: Product[] = [];
  try {
    list = (await sqlStore.listProducts()).filter((p) => p.active).map(toPublic);
  } catch (e) {
    console.error("[catalog] database read failed, using data/products.json", e);
    list = (await fileStore.listProducts()).filter((p) => p.active).map(toPublic);
  }
  return list;
}

export async function getCatalogProduct(slug: string) {
  return (await getCatalog()).find((p) => p.slug === slug) ?? null;
}
