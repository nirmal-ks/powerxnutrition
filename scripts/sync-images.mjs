// Links images in public/products/<slug>.(jpg|png|webp) to products in data/products.json
// that don't have an image yet. Safe to re-run — it never changes anything else.
// Usage: npm run sync-images
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const file = join(process.cwd(), "data", "products.json");
const dir = join(process.cwd(), "public", "products");
const files = existsSync(dir) ? readdirSync(dir) : [];
const products = JSON.parse(readFileSync(file, "utf8"));

let linked = 0;
for (const p of products) {
  if (p.image) continue;
  const f = files.find((x) => x.replace(/\.(jpe?g|png|webp|avif)$/i, "") === p.slug);
  if (f) {
    p.image = `/products/${f}`;
    linked++;
  }
}
writeFileSync(file, JSON.stringify(products, null, 2) + "\n");
const missing = products.filter((p) => !p.image).map((p) => p.slug);
console.log(`Linked ${linked} new images. ${missing.length} products still without an image${missing.length ? ":\n  " + missing.join("\n  ") : "."}`);
