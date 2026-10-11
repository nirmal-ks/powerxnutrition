import { json, readJson, staffRoute } from "@/lib/api";
import { can } from "@/lib/permissions";
import { parseProductInput } from "@/lib/product-input";
import { archiveProduct, deleteProduct, getProductAdmin, saveProduct } from "@/lib/server/products";
import { revalidateStore } from "@/lib/server/revalidate";

type P = { slug: string };

export const GET = staffRoute<P>("products.view", async (_req, { db, actor, params }) => {
  const p = await getProductAdmin(db, params.slug, can(actor.role, "products.cost"));
  return p ? json({ product: p }) : json({ error: "Product not found" }, 404);
});

export const PUT = staffRoute<P>("products.edit", async (req, { db, actor, params }) => {
  const [product, error] = parseProductInput(await readJson(req));
  if (!product) return json({ error }, 400);
  if (product.slug !== params.slug && (await getProductAdmin(db, product.slug))) {
    return json({ error: `A product with URL "${product.slug}" already exists` }, 409);
  }
  const saved = await db.tx((q) => saveProduct(q, actor, product, params.slug));
  revalidateStore();
  return json({ product: saved });
});

/** Quick inline edits from the product list (price / MRP / visibility / featured). Stock is NOT editable here. */
export const PATCH = staffRoute<P>("products.edit", async (req, { db, actor, params }) => {
  const current = await getProductAdmin(db, params.slug, true);
  if (!current) return json({ error: "Product not found" }, 404);
  const body = await readJson<Record<string, unknown>>(req);
  if (body.archive === true) {
    await db.tx((q) => archiveProduct(q, actor, params.slug));
    revalidateStore();
    return json({ ok: true });
  }
  const merged = { ...current, ...body, slug: params.slug };
  // keep variant identities; only price/mrp/minStock may change inline
  if (Array.isArray(body.variants)) {
    merged.variants = current.variants.map((v) => {
      const p = (body.variants as Record<string, unknown>[]).find((x) => x.id === v.id) ?? {};
      return { ...v, price: p.price ?? v.price, mrp: p.mrp ?? v.mrp, minStock: p.minStock ?? v.minStock, cost: undefined };
    }) as typeof current.variants;
  } else merged.variants = current.variants.map((v) => ({ ...v, cost: undefined }));
  if (body.active !== undefined) merged.status = body.active ? "published" : "draft";
  const [product, error] = parseProductInput(merged as unknown as Record<string, unknown>);
  if (!product) return json({ error }, 400);
  product.variants = product.variants.map((v) => ({ ...v, cost: undefined, stock: 0 }));
  const saved = await db.tx((q) => saveProduct(q, actor, product, params.slug));
  revalidateStore();
  return json({ product: saved });
});

/** Deletes a never-used product; anything with history must be archived instead. */
export const DELETE = staffRoute<P>("products.edit", async (_req, { db, actor, params }) => {
  await db.tx((q) => deleteProduct(q, actor, params.slug));
  revalidateStore();
  return json({ ok: true });
});
