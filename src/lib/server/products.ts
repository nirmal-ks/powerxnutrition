import type { Queryable } from "@/lib/db/adapter";
import { newId } from "@/lib/db/ids";
import type { Actor } from "@/lib/permissions";
import { can } from "@/lib/permissions";
import type { CategorySlug, ImageStatus, Product, PublicationStatus, Variant } from "@/types";
import { audit } from "./audit";
import { conflict, forbidden, notFound } from "./errors";
import { addStock } from "./inventory";

interface ProductRow {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: string;
  description: string;
  image: string;
  image_status: ImageStatus;
  status: PublicationStatus;
  featured: boolean;
  sort: number;
  hsn: string;
  gst_rate: number | null;
  default_supplier_id: string | null;
  track_expiry: boolean;
}
interface VariantRow {
  id: string;
  product_id: string;
  code: string;
  label: string;
  flavour: string;
  sku: string | null;
  barcode: string | null;
  price: number;
  mrp: number;
  stock: number;
  avg_cost: number | null;
  min_stock: number;
  active: boolean;
  sort: number;
}

function toProducts(rows: ProductRow[], vrows: VariantRow[], includeCost: boolean): Product[] {
  const byProduct = new Map<string, VariantRow[]>();
  for (const v of vrows) {
    const list = byProduct.get(v.product_id) ?? [];
    list.push(v);
    byProduct.set(v.product_id, list);
  }
  return rows.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    category: p.category as CategorySlug,
    description: p.description,
    // Only an APPROVED image is ever shown to customers; otherwise the clean placeholder.
    image: p.image_status === "APPROVED" ? p.image : "",
    imageStatus: p.image_status,
    status: p.status,
    active: p.status === "published",
    featured: p.featured,
    sort: p.sort,
    hsn: p.hsn,
    gstRate: p.gst_rate,
    supplierId: p.default_supplier_id,
    trackExpiry: p.track_expiry,
    variants: (byProduct.get(p.id) ?? [])
      .sort((a, b) => a.sort - b.sort)
      .map(
        (v): Variant => ({
          id: v.code,
          dbId: v.id,
          label: v.label,
          flavour: v.flavour,
          price: v.price,
          mrp: v.mrp,
          stock: v.stock,
          sku: v.sku ?? "",
          barcode: v.barcode ?? "",
          minStock: v.min_stock,
          ...(includeCost ? { cost: v.avg_cost } : {}),
        }),
      ),
  }));
}

const P_COLS = "id, slug, name, brand, category, description, image, image_status, status, featured, sort, hsn, gst_rate, default_supplier_id, track_expiry";
const V_COLS = "id, product_id, code, label, flavour, sku, barcode, price, mrp, stock, avg_cost, min_stock, active, sort";

export async function listProducts(q: Queryable, opts: { includeArchived?: boolean; publishedOnly?: boolean; includeCost?: boolean } = {}) {
  const where = opts.publishedOnly ? "where status = 'published'" : opts.includeArchived ? "" : "where status <> 'archived'";
  const rows = await q.query<ProductRow>(`select ${P_COLS} from products ${where} order by sort, name`);
  if (!rows.length) return [];
  const vrows = await q.query<VariantRow>(`select ${V_COLS} from product_variants where active and product_id = any($1::text[])`, [rows.map((r) => r.id)]);
  return toProducts(rows, vrows, Boolean(opts.includeCost));
}

/** Admin view keeps the real image + status even when not approved (for the review screen). */
export async function getProductAdmin(q: Queryable, slug: string, includeCost = false) {
  const rows = await q.query<ProductRow>(`select ${P_COLS} from products where slug = $1`, [slug]);
  if (!rows[0]) return null;
  const vrows = await q.query<VariantRow>(`select ${V_COLS} from product_variants where active and product_id = $1`, [rows[0].id]);
  const [p] = toProducts(rows, vrows, includeCost);
  return { ...p, image: rows[0].image };
}

export async function getProduct(q: Queryable, slug: string) {
  const rows = await q.query<ProductRow>(`select ${P_COLS} from products where slug = $1`, [slug]);
  if (!rows[0]) return null;
  const vrows = await q.query<VariantRow>(`select ${V_COLS} from product_variants where active and product_id = $1`, [rows[0].id]);
  return toProducts(rows, vrows, false)[0];
}

function uniqueViolation(e: unknown) {
  const msg = String((e as Error)?.message ?? "");
  if (msg.includes("product_variants_sku_uq")) return conflict("That SKU is already used by another product");
  if (msg.includes("product_variants_barcode_uq")) return conflict("That barcode is already used by another product");
  if (msg.includes("products_slug_key")) return conflict("Another product already uses this page URL");
  return null;
}

/**
 * Creates or updates a product and its variants. Stock is NEVER set here: it only changes through
 * inventory movements. Exception: brand-new variants may get an opening quantity, recorded as an
 * OPENING movement (needs inventory.adjust). Price/cost changes are audited; old sales keep their
 * own frozen prices & costs, so history never changes.
 */
export async function saveProduct(
  q: Queryable,
  actor: Actor,
  product: Product,
  originalSlug?: string,
): Promise<Product> {
  const existing = await q.query<ProductRow>(`select ${P_COLS} from products where slug = $1`, [originalSlug ?? product.slug]);
  const cur = existing[0];
  const id = cur?.id ?? newId();
  const status: PublicationStatus = product.status ?? (product.active ? "published" : "draft");

  // Image: a changed image entered by staff on the product form is treated as approved by them
  // (they chose/uploaded it). Candidate images from search go through the review queue instead.
  let image = cur?.image ?? "";
  let imageStatus: ImageStatus = cur?.image_status ?? "IMAGE_PENDING";
  if (product.image !== undefined && product.image !== (cur?.image ?? "")) {
    if (product.image && !can(actor.role, "images.review")) throw forbidden("Only the owner or a manager can publish product photos");
    image = product.image;
    imageStatus = product.image ? "APPROVED" : "IMAGE_PENDING";
  }

  try {
    if (cur) {
      await q.query(
        `update products set slug=$2, name=$3, brand=$4, category=$5, description=$6, image=$7, image_status=$8, status=$9,
           featured=$10, sort=$11, hsn=$12, gst_rate=$13, default_supplier_id=$14, track_expiry=$15, updated_at=now() where id=$1`,
        [id, product.slug, product.name, product.brand, product.category, product.description, image, imageStatus, status,
          product.featured, product.sort, product.hsn ?? cur.hsn, product.gstRate === undefined ? cur.gst_rate : product.gstRate,
          product.supplierId === undefined ? cur.default_supplier_id : product.supplierId || null,
          product.trackExpiry ?? cur.track_expiry],
      );
    } else {
      await q.query(
        `insert into products (id, slug, name, brand, category, description, image, image_status, status, featured, sort, hsn, gst_rate, default_supplier_id, track_expiry)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [id, product.slug, product.name, product.brand, product.category, product.description, image, imageStatus, status,
          product.featured, product.sort, product.hsn ?? "", product.gstRate ?? null, product.supplierId || null, product.trackExpiry ?? false],
      );
    }

    const curVariants = await q.query<VariantRow>(`select ${V_COLS} from product_variants where product_id = $1`, [id]);
    const byCode = new Map(curVariants.map((v) => [v.code, v]));
    const priceChanges: string[] = [];
    const costChanges: string[] = [];
    const keep = new Set<string>();

    for (const [i, v] of product.variants.entries()) {
      const old = byCode.get(v.id);
      keep.add(v.id);
      const minStock = v.minStock ?? old?.min_stock ?? 2;
      if (old) {
        if (old.price !== v.price || old.mrp !== v.mrp) priceChanges.push(`${v.label}: ₹${old.price}→₹${v.price} (MRP ₹${old.mrp}→₹${v.mrp})`);
        let avgCost = old.avg_cost;
        if (v.cost !== undefined && v.cost !== null && v.cost !== old.avg_cost) {
          if (!can(actor.role, "products.cost")) throw forbidden("You can't change purchase costs");
          costChanges.push(`${v.label}: ${old.avg_cost ?? "unknown"}→${v.cost}`);
          avgCost = v.cost;
        }
        await q.query(
          `update product_variants set label=$2, flavour=$3, sku=$4, barcode=$5, price=$6, mrp=$7, min_stock=$8, avg_cost=$9, active=true, sort=$10, updated_at=now() where id=$1`,
          [old.id, v.label, v.flavour ?? "", v.sku || null, v.barcode || null, v.price, v.mrp, minStock, avgCost, i],
        );
      } else {
        const vid = newId();
        if (v.cost !== undefined && v.cost !== null && !can(actor.role, "products.cost")) throw forbidden("You can't set purchase costs");
        await q.query(
          `insert into product_variants (id, product_id, code, label, flavour, sku, barcode, price, mrp, stock, avg_cost, min_stock, sort)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,$10,$11,$12)`,
          [vid, id, v.id, v.label, v.flavour ?? "", v.sku || null, v.barcode || null, v.price, v.mrp, v.cost ?? null, minStock, i],
        );
        if (v.stock > 0) {
          if (!can(actor.role, "inventory.adjust")) throw forbidden("Opening stock can only be entered by the owner or a manager — receive it as a purchase instead");
          await addStock(q, { variantId: vid, qty: v.stock, type: "OPENING", refType: "opening", refId: vid, actor, note: "Opening stock (product created)", unitCost: v.cost ?? null });
        }
      }
    }
    // Sizes removed from the form: delete if never used, otherwise just hide (history stays intact).
    for (const old of curVariants) {
      if (keep.has(old.code) || !old.active) continue;
      const used = await q.query("select 1 from inventory_movements where variant_id = $1 union all select 1 from sale_items where variant_id = $1 union all select 1 from purchase_items where variant_id = $1 limit 1", [old.id]);
      if (used.length) await q.query("update product_variants set active = false, updated_at = now() where id = $1", [old.id]);
      else await q.query("delete from product_variants where id = $1", [old.id]);
    }

    await audit(q, actor, cur ? "product.updated" : "product.created", { type: "product", id }, `${cur ? "Updated" : "Created"} ${product.name}`, {
      slug: product.slug,
      status,
      ...(priceChanges.length ? { priceChanges } : {}),
      ...(costChanges.length ? { costChanges } : {}),
      ...(cur && cur.status !== status ? { statusChange: `${cur.status}→${status}` } : {}),
      ...(cur && cur.image !== image ? { imageChanged: true } : {}),
    });
  } catch (e) {
    throw uniqueViolation(e) ?? e;
  }
  return (await getProductAdmin(q, product.slug, can(actor.role, "products.cost")))!;
}

/** Archive hides a product everywhere but keeps all history. */
export async function archiveProduct(q: Queryable, actor: Actor, slug: string) {
  const rows = await q.query<{ id: string; name: string }>("update products set status='archived', updated_at=now() where slug=$1 returning id, name", [slug]);
  if (!rows[0]) throw notFound("Product not found");
  await audit(q, actor, "product.archived", { type: "product", id: rows[0].id }, `Archived ${rows[0].name}`);
}

/** Hard delete only for products that were never sold, bought or stocked. */
export async function deleteProduct(q: Queryable, actor: Actor, slug: string) {
  const rows = await q.query<{ id: string; name: string }>("select id, name from products where slug = $1", [slug]);
  if (!rows[0]) return;
  const used = await q.query(
    `select 1 from product_variants v where v.product_id = $1 and (
       exists (select 1 from inventory_movements m where m.variant_id = v.id) or
       exists (select 1 from sale_items s where s.variant_id = v.id) or
       exists (select 1 from purchase_items pi where pi.variant_id = v.id)) limit 1`,
    [rows[0].id],
  );
  if (used.length) throw conflict("This product has stock or sales history, so it can't be deleted. Archive it instead — it disappears from the store and lists but history is kept.");
  await q.query("delete from image_candidates where product_id = $1", [rows[0].id]);
  await q.query("delete from products where id = $1", [rows[0].id]);
  await audit(q, actor, "product.deleted", { type: "product", id: rows[0].id }, `Deleted ${rows[0].name}`);
}

/** Fast lookup for POS / stock-in: name, brand, SKU, barcode (exact barcode/SKU first). */
export async function searchVariants(q: Queryable, term: string, opts: { includeCost?: boolean; limit?: number; includeDrafts?: boolean } = {}) {
  const t = term.trim();
  if (!t) return [];
  const words = t.split(/\s+/).filter(Boolean).slice(0, 5);
  const params: unknown[] = [t.toUpperCase(), t];
  const wordSql = words
    .map((w) => {
      params.push(`%${w}%`);
      const n = params.length;
      return `(p.name ilike $${n} or p.brand ilike $${n} or v.label ilike $${n} or v.flavour ilike $${n} or coalesce(v.sku,'') ilike $${n})`;
    })
    .join(" and ");
  params.push(Math.min(opts.limit ?? 20, 50));
  return q.query<{
    variant_id: string;
    product_id: string;
    slug: string;
    name: string;
    brand: string;
    category: string;
    label: string;
    flavour: string;
    sku: string | null;
    barcode: string | null;
    price: number;
    mrp: number;
    stock: number;
    image: string;
    status: string;
    avg_cost?: number | null;
    min_stock: number;
    gst_rate: number | null;
  }>(
    `select v.id as variant_id, p.id as product_id, p.slug, p.name, p.brand, p.category, v.label, v.flavour, v.sku, v.barcode,
            v.price, v.mrp, v.stock, case when p.image_status = 'APPROVED' then p.image else '' end as image, p.status,
            ${opts.includeCost ? "v.avg_cost," : ""} v.min_stock, p.gst_rate
     from product_variants v join products p on p.id = v.product_id
     where v.active and p.status <> 'archived' ${opts.includeDrafts === false ? "and p.status = 'published'" : ""}
       and (upper(coalesce(v.sku,'')) = $1 or coalesce(v.barcode,'') = $2 or (${wordSql}))
     order by (upper(coalesce(v.sku,'')) = $1 or coalesce(v.barcode,'') = $2) desc, (v.stock > 0) desc, p.sort, p.name, v.sort
     limit $${params.length}`,
    params,
  );
}
