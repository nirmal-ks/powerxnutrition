import type { Queryable } from "@/lib/db/adapter";
import { isConfidentMatch, scoreMatch, type MatchResult } from "@/lib/matching";

export interface CatalogVariant {
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
  stock: number;
  image: string;
  image_status: string;
}

export async function loadCatalogVariants(q: Queryable): Promise<CatalogVariant[]> {
  return q.query<CatalogVariant>(
    `select v.id as variant_id, p.id as product_id, p.slug, p.name, p.brand, p.category, v.label, v.flavour, v.sku, v.barcode, v.price, v.stock,
            p.image, p.image_status
     from product_variants v join products p on p.id = v.product_id where v.active and p.status <> 'archived'`,
  );
}

export interface ProductMatch {
  /** Set only for an exact SKU/barcode hit or a fully confident name+size+flavour match. */
  match: (CatalogVariant & { how: "sku" | "barcode" | "name" }) | null;
  candidates: (CatalogVariant & { result: MatchResult })[];
}

/** SKU → barcode → scored name match. Never guesses: anything uncertain is returned as a candidate. */
export function matchAgainst(
  catalog: CatalogVariant[],
  item: { sku?: string; barcode?: string; brand?: string; name?: string; size?: string; flavour?: string },
): ProductMatch {
  const sku = (item.sku ?? "").trim().toUpperCase();
  const barcode = (item.barcode ?? "").trim();
  if (sku) {
    const hit = catalog.find((c) => (c.sku ?? "").toUpperCase() === sku);
    if (hit) return { match: { ...hit, how: "sku" }, candidates: [] };
  }
  if (barcode) {
    const hit = catalog.find((c) => (c.barcode ?? "") === barcode);
    if (hit) return { match: { ...hit, how: "barcode" }, candidates: [] };
  }
  if (!item.name) return { match: null, candidates: [] };
  const scored = catalog
    .map((c) => ({ ...c, result: scoreMatch({ brand: item.brand ?? "", name: item.name!, size: item.size, flavour: item.flavour }, { brand: c.brand, name: c.name, size: c.label, flavour: c.flavour }) }))
    .filter((c) => c.result.score >= 35)
    .sort((a, b) => b.result.score - a.result.score)
    .slice(0, 5);
  const top = scored[0];
  const second = scored[1];
  // confident only if clearly better than the runner-up (two sizes of the same product must not tie)
  if (top && isConfidentMatch(top.result) && (!second || top.result.score - second.result.score >= 10)) {
    return { match: { ...top, how: "name" }, candidates: scored };
  }
  return { match: null, candidates: scored };
}
