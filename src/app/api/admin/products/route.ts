import { json, readJson, staffRoute } from "@/lib/api";
import { can } from "@/lib/permissions";
import { parseProductInput } from "@/lib/product-input";
import { getProductAdmin, listProducts, saveProduct } from "@/lib/server/products";
import { revalidateStore } from "@/lib/server/revalidate";

export const GET = staffRoute("products.view", async (req, { db, actor }) => {
  const archived = new URL(req.url).searchParams.get("archived") === "1";
  return json({ products: await listProducts(db, { includeArchived: archived, includeCost: can(actor.role, "products.cost") }) });
});

export const POST = staffRoute("products.edit", async (req, { db, actor }) => {
  const [product, error] = parseProductInput(await readJson(req));
  if (!product) return json({ error }, 400);
  if (await getProductAdmin(db, product.slug)) return json({ error: `A product with URL "${product.slug}" already exists` }, 409);
  const saved = await db.tx((q) => saveProduct(q, actor, product));
  revalidateStore();
  return json({ product: saved }, 201);
});
