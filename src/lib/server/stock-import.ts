import type { Db, Queryable } from "@/lib/db/adapter";
import { newId } from "@/lib/db/ids";
import { categories } from "@/lib/catalog";
import { can, type Actor } from "@/lib/permissions";
import { audit } from "./audit";
import { bad, conflict, forbidden, notFound } from "./errors";
import { loadCatalogVariants, matchAgainst } from "./product-match";
import { confirmPurchase, findDuplicateInvoice, savePurchaseDraft, type PurchaseLineInput } from "./purchases";
import { supplierKey } from "./suppliers";
import { parseCsv, readXlsx } from "./xlsx";

/**
 * Bulk stock import (Excel / CSV), staged:
 *   upload → parse & validate → match (SKU, then barcode, then careful name match) → PREVIEW saved
 *   → staff corrects / rejects rows → authorised CONFIRM → purchase(s) created and confirmed in ONE
 *   transaction. Uploading never changes stock; a failed confirm changes nothing.
 */

export const TEMPLATE_COLUMNS = [
  "SKU", "Barcode", "Brand", "Product Name", "Category", "Size", "Flavour", "Quantity", "Purchase Cost", "Selling Price", "MRP", "GST %",
  "Supplier", "Supplier Invoice No", "Batch No", "Mfg Date", "Expiry Date",
] as const;

export const TEMPLATE_EXAMPLE = [
  "ON-GSW-2LB-DRC", "748927024166", "Optimum Nutrition", "Gold Standard 100% Whey", "whey-protein", "907 g (2 lb)", "Double Rich Chocolate", "6",
  "2650", "3299", "3999", "18", "Sri Murugan Traders", "INV-1042", "B2409A", "2026-08-01", "2028-07-31",
];

const ALIASES: Record<string, string[]> = {
  sku: ["sku", "item code", "product code", "code"],
  barcode: ["barcode", "ean", "upc", "gtin", "bar code"],
  brand: ["brand", "make", "company"],
  name: ["product name", "product", "item", "item name", "name", "description"],
  category: ["category", "type"],
  size: ["size", "pack", "pack size", "weight", "variant"],
  flavour: ["flavour", "flavor", "taste"],
  qty: ["quantity", "qty", "qty received", "received", "units"],
  cost: ["purchase cost", "cost", "cost price", "unit cost", "rate", "purchase price", "buying price"],
  price: ["selling price", "price", "sale price", "sp"],
  mrp: ["mrp"],
  gst: ["gst %", "gst", "tax %", "gst rate", "tax"],
  supplier: ["supplier", "vendor", "distributor", "supplier name"],
  invoiceNo: ["supplier invoice no", "invoice no", "invoice number", "bill no", "invoice"],
  batchNo: ["batch no", "batch", "batch number", "lot", "lot no"],
  mfgDate: ["mfg date", "manufacturing date", "mfg", "mfd"],
  expiryDate: ["expiry date", "expiry", "exp", "exp date", "best before", "use by"],
};

export interface ImportRow {
  line: number;
  sku: string;
  barcode: string;
  brand: string;
  name: string;
  category: string;
  size: string;
  flavour: string;
  qty: string;
  cost: string;
  price: string;
  mrp: string;
  gst: string;
  supplier: string;
  invoiceNo: string;
  batchNo: string;
  mfgDate: string;
  expiryDate: string;
  // review state
  action: "existing" | "new" | "reject";
  variantId: string | null;
  matchedBy: string;
  matchLabel: string;
  supplierId: string | null;
  candidates: { variantId: string; label: string; score: number; reasons: string[] }[];
  errors: string[];
  warnings: string[];
}

export function parseSpreadsheet(fileName: string, bytes: Buffer): string[][] {
  if (/\.xlsx$/i.test(fileName) || bytes.subarray(0, 2).toString() === "PK") return readXlsx(bytes);
  if (/\.xls$/i.test(fileName)) throw bad("Old .xls files aren't supported — in Excel use “Save As → Excel Workbook (.xlsx)” or CSV");
  return parseCsv(bytes.toString("utf8"));
}

function mapHeader(header: string[]) {
  const map: Record<string, number> = {};
  header.forEach((h, i) => {
    const k = h.toLowerCase().replace(/\s+/g, " ").replace(/[*:]/g, "").trim();
    for (const [field, names] of Object.entries(ALIASES)) if (map[field] === undefined && names.includes(k)) map[field] = i;
  });
  return map;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Accepts 2028-07-31, 31/07/2028, 31-07-2028, 07/2028 (→ last day of month). */
export function normDate(v: string): string | null {
  const s = v.trim();
  if (!s) return "";
  if (DATE_RE.test(s)) return Number.isNaN(Date.parse(s)) ? null : s;
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    const d = `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    return Number.isNaN(Date.parse(d)) ? null : d;
  }
  m = s.match(/^(\d{1,2})[/.-](\d{4})$/);
  if (m) {
    const last = new Date(Date.UTC(Number(m[2]), Number(m[1]), 0)).getUTCDate();
    return `${m[2]}-${m[1].padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  }
  return null;
}

const num = (v: string) => (v.trim() === "" ? NaN : Number(v.replace(/[₹,\s]/g, "")));

/** Validates one row and fills errors/warnings. Pure apart from the catalogue/supplier lookups passed in. */
export function validateRow(r: ImportRow, ctx: { variantIds: Set<string>; supplierByKey: Map<string, string>; defaultSupplierId?: string | null }) {
  r.errors = [];
  r.warnings = [];
  if (r.action === "reject") return r;
  const qty = num(r.qty);
  if (!Number.isInteger(qty) || qty <= 0) r.errors.push("Quantity must be a whole number above 0");
  const cost = num(r.cost);
  if (!(cost >= 0)) r.errors.push("Purchase cost is missing or invalid");
  if (r.gst && !(num(r.gst) >= 0 && num(r.gst) <= 40)) r.errors.push("GST % must be 0–40");
  for (const [k, label] of [["mfgDate", "Mfg date"], ["expiryDate", "Expiry date"]] as const) {
    const d = normDate(r[k]);
    if (d === null) r.errors.push(`${label} "${r[k]}" is not a valid date (use YYYY-MM-DD or DD/MM/YYYY)`);
    else r[k] = d;
  }
  if (r.expiryDate && r.mfgDate && r.expiryDate < r.mfgDate) r.errors.push("Expiry date is before the mfg date");
  if (r.expiryDate && r.expiryDate < new Date().toISOString().slice(0, 10)) r.warnings.push("This batch is already expired");

  const sid = r.supplierId ?? (r.supplier ? ctx.supplierByKey.get(supplierKey(r.supplier)) : null) ?? ctx.defaultSupplierId ?? null;
  r.supplierId = sid ?? null;
  if (!sid) r.errors.push(r.supplier ? `Supplier “${r.supplier}” not found — add it in Suppliers first, or choose a supplier for the whole file` : "Supplier is missing");

  if (r.action === "existing") {
    if (!r.variantId || !ctx.variantIds.has(r.variantId)) r.errors.push(r.candidates.length ? "Possible matches found — choose the right product (size & flavour!) or mark as new" : "No matching product — choose one or mark as new");
  } else if (r.action === "new") {
    if (!r.name) r.errors.push("Product name is required for a new product");
    if (!r.brand) r.errors.push("Brand is required for a new product");
    if (!r.size) r.errors.push("Size is required for a new product");
    if (!categories.some((c) => c.slug === r.category)) r.errors.push(`Category must be one of: ${categories.map((c) => c.slug).join(", ")}`);
    if (!(num(r.price) > 0)) r.errors.push("Selling price is required for a new product");
    if (r.candidates.length) r.warnings.push("Similar products exist — make sure this really is a new product/size/flavour");
  }
  return r;
}

export async function buildPreview(q: Queryable, rows: string[][], defaultSupplierId?: string | null) {
  if (rows.length < 2) throw bad("The file has no data rows. Use the template: first row = column names.");
  if (rows.length > 1001) throw bad("Maximum 1000 rows per import — split the file");
  const map = mapHeader(rows[0]);
  for (const need of ["qty", "cost"]) if (map[need] === undefined) throw bad(`Column “${need === "qty" ? "Quantity" : "Purchase Cost"}” not found. Download the template to see the expected columns.`);
  if (map.sku === undefined && map.barcode === undefined && map.name === undefined) throw bad("Add at least one of SKU, Barcode or Product Name columns");

  const catalog = await loadCatalogVariants(q);
  const suppliers = await q.query<{ id: string; name_key: string }>("select id, name_key from suppliers where active");
  const supplierByKey = new Map(suppliers.map((s) => [s.name_key, s.id]));
  const variantIds = new Set(catalog.map((c) => c.variant_id));
  const cell = (r: string[], k: string) => (map[k] !== undefined ? String(r[map[k]] ?? "").trim() : "");

  return rows.slice(1).map((raw, i) => {
    const row: ImportRow = {
      line: i + 2,
      sku: cell(raw, "sku").toUpperCase(),
      barcode: cell(raw, "barcode").replace(/\s+/g, ""),
      brand: cell(raw, "brand"),
      name: cell(raw, "name"),
      category: cell(raw, "category").toLowerCase().replace(/\s+/g, "-"),
      size: cell(raw, "size"),
      flavour: cell(raw, "flavour"),
      qty: cell(raw, "qty"),
      cost: cell(raw, "cost"),
      price: cell(raw, "price"),
      mrp: cell(raw, "mrp"),
      gst: cell(raw, "gst").replace("%", ""),
      supplier: cell(raw, "supplier"),
      invoiceNo: cell(raw, "invoiceNo"),
      batchNo: cell(raw, "batchNo"),
      mfgDate: cell(raw, "mfgDate"),
      expiryDate: cell(raw, "expiryDate"),
      action: "existing",
      variantId: null,
      matchedBy: "",
      matchLabel: "",
      supplierId: null,
      candidates: [],
      errors: [],
      warnings: [],
    };
    const m = matchAgainst(catalog, { sku: row.sku, barcode: row.barcode, brand: row.brand, name: row.name, size: row.size, flavour: row.flavour });
    const label = (c: { brand: string; name: string; label: string; flavour: string; sku: string | null }) => `${c.brand} ${c.name} · ${c.label}${c.flavour ? ` · ${c.flavour}` : ""}${c.sku ? ` (${c.sku})` : ""}`;
    row.candidates = m.candidates.map((c) => ({ variantId: c.variant_id, label: label(c), score: c.result.score, reasons: c.result.reasons }));
    if (m.match) {
      row.variantId = m.match.variant_id;
      row.matchedBy = m.match.how;
      row.matchLabel = label(m.match);
    } else if (!m.candidates.length && row.name && row.brand) {
      row.action = "new";
    }
    return validateRow(row, { variantIds, supplierByKey, defaultSupplierId });
  });
}

export async function createImportPreview(q: Queryable, actor: Actor, fileName: string, bytes: Buffer, defaultSupplierId?: string | null) {
  if (!can(actor.role, "purchases.create")) throw forbidden();
  let rows: string[][];
  try {
    rows = parseSpreadsheet(fileName, bytes);
  } catch (e) {
    throw bad((e as Error).message || "Couldn't read the file");
  }
  const preview = await buildPreview(q, rows, defaultSupplierId);
  const id = newId();
  await q.query("insert into stock_imports (id, file_name, status, supplier_id, rows, created_by) values ($1,$2,'preview',$3,$4,$5)", [
    id,
    fileName.slice(0, 120),
    defaultSupplierId || null,
    JSON.stringify(preview),
    actor.id,
  ]);
  await audit(q, actor, "import.previewed", { type: "stock_import", id }, `Uploaded ${fileName}: ${preview.length} row(s) — preview only, no stock changed`);
  return { id, rows: preview };
}

/** Staff corrections from the review screen: re-validated on the server. */
export async function updateImportRows(q: Queryable, actor: Actor, id: string, patch: { rows: Partial<ImportRow>[]; supplierId?: string | null }) {
  const cur = await q.query<{ status: string; rows: ImportRow[]; supplier_id: string | null }>("select status, rows, supplier_id from stock_imports where id = $1 for update", [id]);
  if (!cur[0]) throw notFound("Import not found");
  if (cur[0].status !== "preview") throw conflict("This import was already confirmed or discarded");
  const catalog = await loadCatalogVariants(q);
  const variantIds = new Set(catalog.map((c) => c.variant_id));
  const suppliers = await q.query<{ id: string; name_key: string }>("select id, name_key from suppliers where active");
  const supplierByKey = new Map(suppliers.map((s) => [s.name_key, s.id]));
  const defaultSupplierId = patch.supplierId === undefined ? cur[0].supplier_id : patch.supplierId;
  const editable: (keyof ImportRow)[] = ["sku", "barcode", "brand", "name", "category", "size", "flavour", "qty", "cost", "price", "mrp", "gst", "supplier", "invoiceNo", "batchNo", "mfgDate", "expiryDate"];
  const byLine = new Map(patch.rows.map((r) => [r.line, r]));
  const rows = cur[0].rows.map((r) => {
    const p = byLine.get(r.line);
    if (!p) return validateRow({ ...r, supplierId: patch.supplierId !== undefined ? null : r.supplierId }, { variantIds, supplierByKey, defaultSupplierId });
    const next: ImportRow = { ...r };
    for (const k of editable) if (typeof p[k] === "string") (next as unknown as Record<string, unknown>)[k] = String(p[k]).slice(0, 200);
    if (p.action === "existing" || p.action === "new" || p.action === "reject") next.action = p.action;
    if (p.variantId !== undefined) {
      next.variantId = p.variantId;
      const c = catalog.find((x) => x.variant_id === p.variantId);
      next.matchedBy = c ? "chosen by staff" : "";
      next.matchLabel = c ? `${c.brand} ${c.name} · ${c.label}${c.flavour ? ` · ${c.flavour}` : ""}` : "";
    }
    next.supplierId = typeof p.supplierId === "string" ? p.supplierId : patch.supplierId !== undefined ? null : r.supplierId;
    if (next.supplierId && !suppliers.some((s) => s.id === next.supplierId)) next.supplierId = null;
    return validateRow(next, { variantIds, supplierByKey, defaultSupplierId });
  });
  await q.query("update stock_imports set rows = $2, supplier_id = $3 where id = $1", [id, JSON.stringify(rows), defaultSupplierId || null]);
  return rows;
}

/**
 * Confirms the import atomically: one purchase per supplier (+invoice no), each confirmed. If any
 * row still has errors, nothing happens. Rejected rows are skipped and listed in the summary.
 */
export async function confirmImport(db: Db, actor: Actor, id: string, opts: { overrideDuplicateReason?: string } = {}) {
  if (!can(actor.role, "purchases.confirm")) throw forbidden("You can't confirm stock receipts");
  try {
    return await db.tx(async (q) => {
      const cur = await q.query<{ status: string; rows: ImportRow[]; file_name: string; purchase_id: string | null; summary: unknown }>(
        "select status, rows, file_name, purchase_id, summary from stock_imports where id = $1 for update",
        [id],
      );
      if (!cur[0]) throw notFound("Import not found");
      if (cur[0].status === "confirmed") return { duplicate: true, summary: cur[0].summary };
      if (cur[0].status !== "preview") throw conflict("This import was discarded");
      const rows = cur[0].rows;
      const bad_ = rows.filter((r) => r.action !== "reject" && r.errors.length);
      if (bad_.length) throw bad(`${bad_.length} row(s) still have errors (lines ${bad_.slice(0, 8).map((r) => r.line).join(", ")}). Fix or reject them first.`);
      const good = rows.filter((r) => r.action !== "reject");
      if (!good.length) throw bad("Every row is rejected — nothing to import");

      const groups = new Map<string, ImportRow[]>();
      for (const r of good) {
        const key = `${r.supplierId}|${r.invoiceNo.trim().toLowerCase()}`;
        groups.set(key, [...(groups.get(key) ?? []), r]);
      }
      const purchases: { purchaseNo: string; id: string; supplierId: string; lines: number; units: number }[] = [];
      for (const [key, list] of groups) {
        const [supplierId] = key.split("|");
        const invoiceNo = list[0].invoiceNo.trim();
        if (invoiceNo && !opts.overrideDuplicateReason) {
          const dup = await findDuplicateInvoice(q, supplierId, invoiceNo);
          if (dup) throw conflict(`Supplier invoice ${invoiceNo} was already received in ${dup.purchase_no}. Importing it again would double the stock.`, { code: "DUPLICATE_INVOICE", duplicateOf: dup.purchase_no });
        }
        const lines: PurchaseLineInput[] = list.map((r) => ({
          variantId: r.action === "existing" ? r.variantId : null,
          newProduct:
            r.action === "new"
              ? { name: r.name, brand: r.brand, category: r.category, label: r.size, flavour: r.flavour, sku: r.sku, barcode: r.barcode, price: num(r.price), mrp: num(r.mrp) || num(r.price), gstRate: r.gst ? num(r.gst) : null }
              : null,
          qty: num(r.qty),
          unitCost: num(r.cost),
          taxRate: r.gst ? num(r.gst) : null,
          batchNo: r.batchNo,
          mfgDate: r.mfgDate || null,
          expiryDate: r.expiryDate || null,
          description: `Import ${cur[0].file_name} line ${r.line}`,
        }));
        const draft = await savePurchaseDraft(q, actor, { supplierId, supplierInvoiceNo: invoiceNo, notes: `Imported from ${cur[0].file_name}`, lines, source: "csv", stockImportId: id });
        await confirmPurchase(q, actor, draft.id, { overrideDuplicateReason: opts.overrideDuplicateReason });
        purchases.push({ purchaseNo: draft.purchase_no, id: draft.id, supplierId, lines: list.length, units: list.reduce((s, r) => s + num(r.qty), 0) });
      }
      const summary = {
        imported: good.length,
        rejected: rows.length - good.length,
        units: purchases.reduce((s, p) => s + p.units, 0),
        newProducts: good.filter((r) => r.action === "new").length,
        purchases,
      };
      await q.query("update stock_imports set status = 'confirmed', confirmed_at = now(), summary = $2, purchase_id = $3 where id = $1", [id, JSON.stringify(summary), purchases[0]?.id ?? null]);
      await audit(q, actor, "import.confirmed", { type: "stock_import", id }, `Imported ${cur[0].file_name}: ${summary.imported} row(s), ${summary.units} unit(s), ${summary.rejected} rejected`, summary);
      return { duplicate: false, summary };
    });
  } catch (e) {
    await db.query("update stock_imports set error = $2 where id = $1 and status = 'preview'", [id, String((e as Error).message).slice(0, 500)]).catch(() => undefined);
    throw e;
  }
}

export async function discardImport(q: Queryable, actor: Actor, id: string) {
  const r = await q.query<{ file_name: string }>("update stock_imports set status = 'discarded' where id = $1 and status = 'preview' returning file_name", [id]);
  if (!r[0]) throw conflict("Only previews can be discarded");
  await audit(q, actor, "import.discarded", { type: "stock_import", id }, `Discarded import ${r[0].file_name}`);
}

export async function getImport(q: Queryable, id: string) {
  return (await q.query<{ id: string; file_name: string; status: string; supplier_id: string | null; rows: ImportRow[]; summary: unknown; error: string | null; created_at: string }>(
    "select id, file_name, status, supplier_id, rows, summary, error, created_at from stock_imports where id = $1",
    [id],
  ))[0] ?? null;
}

export async function listImports(q: Queryable) {
  return q.query<{ id: string; file_name: string; status: string; rows: number; errors: number; summary: unknown; created_at: string; confirmed_at: string | null; created_by_name: string | null }>(
    `select i.id, i.file_name, i.status, jsonb_array_length(i.rows)::int as rows,
            (select count(*) from jsonb_array_elements(i.rows) r where r->>'action' <> 'reject' and jsonb_array_length(r->'errors') > 0)::int as errors,
            i.summary, i.created_at, i.confirmed_at, s.name as created_by_name
     from stock_imports i left join staff s on s.id = i.created_by order by i.created_at desc limit 50`,
  );
}
