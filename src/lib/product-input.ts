import type { CategorySlug, Product, PublicationStatus, Variant } from "@/types";
import { categories } from "./catalog";

export const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : typeof v === "number" ? String(v).slice(0, max) : "");
const int = (v: unknown) => Math.max(0, Math.round(Number(v) || 0));
const money = (v: unknown) => Math.max(0, Math.round((Number(v) || 0) * 100) / 100);

/** Validates product data coming from the admin form. Returns [product, error]. */
export function parseProductInput(raw: Record<string, unknown>): [Product | null, string | null] {
  const name = str(raw.name, 120);
  if (!name) return [null, "Product name is required"];
  const slug = slugify(str(raw.slug, 80) || name);
  if (!slug) return [null, "Enter a product name with letters or numbers"];
  const category = str(raw.category, 40) as CategorySlug;
  if (!categories.some((c) => c.slug === category)) return [null, "Choose a valid category"];

  const rawVariants = Array.isArray(raw.variants) ? raw.variants : [];
  const seen = new Set<string>();
  const skus = new Set<string>();
  const barcodes = new Set<string>();
  const variants: Variant[] = [];
  for (const v of rawVariants as Record<string, unknown>[]) {
    const label = str(v.label, 40);
    if (!label) continue;
    const flavour = str(v.flavour, 60);
    // keep the existing id (carts & order history refer to it); new sizes get one from size + flavour
    let id = /^[a-z0-9-]{1,90}$/.test(str(v.id, 90)) ? str(v.id, 90) : slugify(flavour ? `${label} ${flavour}` : label) || "default";
    while (seen.has(id)) id += "-x";
    seen.add(id);
    const price = money(v.price);
    const mrp = Math.max(money(v.mrp), price);
    if (!price) return [null, `Enter a selling price for "${label}${flavour ? ` · ${flavour}` : ""}"`];
    const sku = str(v.sku, 40).toUpperCase().replace(/\s+/g, "");
    const barcode = str(v.barcode, 40).replace(/\s+/g, "");
    if (sku && skus.has(sku)) return [null, `SKU ${sku} is used twice`];
    if (barcode && barcodes.has(barcode)) return [null, `Barcode ${barcode} is used twice`];
    if (barcode && !/^[0-9A-Za-z-]{4,40}$/.test(barcode)) return [null, `Barcode "${barcode}" has invalid characters`];
    if (sku) skus.add(sku);
    if (barcode) barcodes.add(barcode);
    const cost = v.cost === null || v.cost === undefined || v.cost === "" ? undefined : money(v.cost);
    variants.push({
      id,
      label,
      flavour,
      price,
      mrp,
      stock: int(v.stock),
      sku,
      barcode,
      minStock: v.minStock === undefined || v.minStock === "" ? undefined : int(v.minStock),
      ...(cost !== undefined ? { cost } : {}),
    });
  }
  if (!variants.length) return [null, "Add at least one size with a price"];

  const statusRaw = str(raw.status, 20) as PublicationStatus;
  const status: PublicationStatus = ["draft", "published", "archived"].includes(statusRaw)
    ? statusRaw
    : raw.active === undefined || raw.active
      ? "published"
      : "draft";
  const gst = raw.gstRate === null || raw.gstRate === undefined || raw.gstRate === "" ? null : Number(raw.gstRate);
  if (gst !== null && !(gst >= 0 && gst <= 40)) return [null, "GST rate must be between 0 and 40%"];
  const hsn = str(raw.hsn, 8).replace(/\D/g, "");
  if (hsn && ![4, 6, 8].includes(hsn.length)) return [null, "HSN code should be 4, 6 or 8 digits"];

  return [
    {
      slug,
      name,
      brand: str(raw.brand, 60) || "PowerX",
      category,
      description: str(raw.description, 3000),
      image: str(raw.image, 500),
      variants,
      featured: Boolean(raw.featured),
      active: status === "published",
      status,
      sort: Number.isFinite(Number(raw.sort)) ? Number(raw.sort) : 999,
      hsn,
      gstRate: gst,
      supplierId: str(raw.supplierId, 64) || null,
      trackExpiry: Boolean(raw.trackExpiry),
    },
    null,
  ];
}
