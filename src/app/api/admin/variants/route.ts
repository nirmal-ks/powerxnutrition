import { json, searchParams, staffRoute } from "@/lib/api";
import { can } from "@/lib/permissions";
import { searchVariants } from "@/lib/server/products";

/**
 * Fast product lookup for the POS and stock-in screens: name, brand, size, flavour, SKU or barcode.
 * ?all=1 returns the whole sellable catalogue (no costs) so the POS can keep searching if the
 * internet drops for a moment.
 */
export const GET = staffRoute(["sales.create", "purchases.create", "products.view"], async (req, { db, actor }) => {
  const sp = searchParams(req);
  if (sp.get("all") === "1") {
    const rows = await db.query(
      `select v.id as variant_id, p.slug, p.name, p.brand, p.category, v.label, v.flavour, v.sku, v.barcode, v.price, v.mrp, v.stock,
              case when p.image_status = 'APPROVED' then p.image else '' end as image, p.status, v.min_stock, p.gst_rate
       from product_variants v join products p on p.id = v.product_id
       where v.active and p.status <> 'archived' order by p.sort, p.name, v.sort limit 3000`,
    );
    return json({ results: rows, cachedAt: new Date().toISOString() });
  }
  const q = (sp.get("q") ?? "").slice(0, 80);
  const rows = await searchVariants(db, q, {
    includeCost: can(actor.role, "products.cost") || can(actor.role, "purchases.create"),
    limit: Number(sp.get("limit")) || 20,
    includeDrafts: sp.get("drafts") !== "0",
  });
  return json({ results: rows });
});
