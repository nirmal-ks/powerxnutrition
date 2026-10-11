import type { Queryable } from "@/lib/db/adapter";
import { newId, nextDocumentNo } from "@/lib/db/ids";
import { whereBuilder } from "@/lib/db/where";
import { toPaise, toRupees } from "@/lib/money";
import { can, type Actor } from "@/lib/permissions";
import { categories } from "@/lib/catalog";
import { slugify } from "@/lib/product-input";
import { audit } from "./audit";
import { bad, conflict, forbidden, notFound } from "./errors";
import { receiveStock } from "./inventory";
import { getSettings } from "./settings";

/**
 * Purchases = stock receiving. A purchase is a DRAFT (no stock effect) until it is CONFIRMED;
 * confirmation is a one-way status change done with a conditional UPDATE, so pressing
 * "Confirm" twice (or two people at once) raises stock only once.
 */

export interface NewProductDraft {
  name: string;
  brand: string;
  category: string;
  label: string;
  flavour?: string;
  sku?: string;
  barcode?: string;
  price: number;
  mrp?: number;
  hsn?: string;
  gstRate?: number | null;
}

export interface PurchaseLineInput {
  variantId?: string | null;
  newProduct?: NewProductDraft | null;
  description?: string;
  qty: number;
  unitCost: number;
  taxRate?: number | null;
  batchNo?: string;
  mfgDate?: string | null;
  expiryDate?: string | null;
}

export interface PurchaseInput {
  supplierId: string;
  supplierInvoiceNo?: string;
  invoiceDate?: string | null;
  notes?: string;
  lines: PurchaseLineInput[];
  discountTotal?: number;
  otherCharges?: number;
  source?: "manual" | "csv" | "invoice";
  invoiceImportId?: string | null;
  stockImportId?: string | null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const dateOrNull = (v: unknown) => (typeof v === "string" && DATE_RE.test(v) && !Number.isNaN(Date.parse(v)) ? v : null);

function validateNewProduct(p: NewProductDraft, line: number): NewProductDraft {
  const out: NewProductDraft = {
    name: str(p.name, 120),
    brand: str(p.brand, 60),
    category: str(p.category, 40),
    label: str(p.label, 40),
    flavour: str(p.flavour, 60),
    sku: str(p.sku, 40).toUpperCase().replace(/\s+/g, ""),
    barcode: str(p.barcode, 40).replace(/\s+/g, ""),
    price: Math.round((Number(p.price) || 0) * 100) / 100,
    mrp: Math.round((Number(p.mrp) || 0) * 100) / 100,
    hsn: str(p.hsn, 8).replace(/\D/g, ""),
    gstRate: p.gstRate === null || p.gstRate === undefined || (p.gstRate as unknown) === "" ? null : Number(p.gstRate),
  };
  if (!out.name) throw bad(`Line ${line}: new product needs a name`);
  if (!out.brand) throw bad(`Line ${line}: new product needs a brand`);
  if (!categories.some((c) => c.slug === out.category)) throw bad(`Line ${line}: choose a category for the new product`);
  if (!out.label) throw bad(`Line ${line}: new product needs a size (e.g. 1 kg)`);
  if (!(out.price > 0)) throw bad(`Line ${line}: enter the selling price for the new product`);
  return out;
}

function validateInput(input: PurchaseInput) {
  if (!input.supplierId) throw bad("Select a supplier");
  if (!Array.isArray(input.lines) || !input.lines.length) throw bad("Add at least one product");
  if (input.lines.length > 300) throw bad("Too many lines in one purchase (max 300)");
  const lines = input.lines.map((l, i) => {
    const n = i + 1;
    const qty = Number(l.qty);
    const unitCost = Math.round((Number(l.unitCost) || 0) * 100) / 100;
    if (!Number.isInteger(qty) || qty <= 0 || qty > 100000) throw bad(`Line ${n}: quantity must be a whole number above 0`);
    if (!(Number(l.unitCost) >= 0) || l.unitCost === null || (l.unitCost as unknown) === "") throw bad(`Line ${n}: enter the purchase cost per unit`);
    if (!l.variantId && !l.newProduct) throw bad(`Line ${n}: choose a product (or fill in the new product details)`);
    const taxRate = l.taxRate === null || l.taxRate === undefined || (l.taxRate as unknown) === "" ? null : Number(l.taxRate);
    if (taxRate !== null && !(taxRate >= 0 && taxRate <= 40)) throw bad(`Line ${n}: GST % must be between 0 and 40`);
    const mfg = dateOrNull(l.mfgDate);
    const exp = dateOrNull(l.expiryDate);
    if (mfg && exp && exp < mfg) throw bad(`Line ${n}: expiry date is before the manufacturing date`);
    return {
      variantId: l.variantId || null,
      newProduct: l.variantId ? null : validateNewProduct(l.newProduct!, n),
      description: str(l.description, 200),
      qty,
      unitCost,
      taxRate,
      batchNo: str(l.batchNo, 40),
      mfgDate: mfg,
      expiryDate: exp,
    };
  });
  return {
    supplierId: String(input.supplierId),
    supplierInvoiceNo: str(input.supplierInvoiceNo, 40),
    invoiceDate: dateOrNull(input.invoiceDate),
    notes: str(input.notes, 1000),
    discountTotal: Math.max(0, Math.round((Number(input.discountTotal) || 0) * 100) / 100),
    otherCharges: Math.max(0, Math.round((Number(input.otherCharges) || 0) * 100) / 100),
    source: input.source === "csv" || input.source === "invoice" ? input.source : "manual",
    invoiceImportId: input.invoiceImportId ?? null,
    stockImportId: input.stockImportId ?? null,
    lines,
  };
}

function totals(lines: { qty: number; unitCost: number; taxRate: number | null }[], discount: number, other: number) {
  let sub = 0;
  let tax = 0;
  const per = lines.map((l) => {
    const base = l.qty * toPaise(l.unitCost);
    const t = l.taxRate ? Math.round((base * l.taxRate) / 100) : 0;
    sub += base;
    tax += t;
    return { tax: t, total: base + t };
  });
  return { per, subtotal: sub, tax, total: sub + tax - toPaise(discount) + toPaise(other) };
}

/** Creates or updates a DRAFT purchase. Never touches stock. */
export async function savePurchaseDraft(q: Queryable, actor: Actor, raw: PurchaseInput, id?: string) {
  if (!can(actor.role, "purchases.create")) throw forbidden();
  const input = validateInput(raw);
  const sup = await q.query("select 1 from suppliers where id = $1", [input.supplierId]);
  if (!sup.length) throw bad("Supplier not found — select or add the supplier first");
  if (input.lines.some((l) => l.variantId)) {
    const ids = input.lines.filter((l) => l.variantId).map((l) => l.variantId!);
    const found = await q.query<{ id: string }>("select id from product_variants where id = any($1::text[])", [ids]);
    if (found.length !== new Set(ids).size) throw bad("One of the products was not found — search and select it again");
  }
  const t = totals(input.lines, input.discountTotal, input.otherCharges);

  let purchaseId = id;
  if (id) {
    const cur = await q.query<{ status: string }>("select status from purchases where id = $1 for update", [id]);
    if (!cur[0]) throw notFound("Purchase not found");
    if (cur[0].status !== "draft") throw conflict("Only draft purchases can be edited. Confirmed purchases are final — record a correction instead.");
    await q.query(
      `update purchases set supplier_id=$2, supplier_invoice_no=$3, invoice_date=$4, notes=$5, subtotal=$6, discount_total=$7, tax_total=$8,
         other_charges=$9, total=$10, updated_at=now() where id=$1`,
      [id, input.supplierId, input.supplierInvoiceNo, input.invoiceDate, input.notes, toRupees(t.subtotal), input.discountTotal, toRupees(t.tax), input.otherCharges, toRupees(t.total)],
    );
    await q.query("delete from purchase_items where purchase_id = $1", [id]);
  } else {
    purchaseId = newId();
    const no = await nextDocumentNo(q, "purchase", "PO");
    await q.query(
      `insert into purchases (id, purchase_no, supplier_id, supplier_invoice_no, invoice_date, status, source, notes, subtotal, discount_total,
         tax_total, other_charges, total, invoice_import_id, stock_import_id, created_by)
       values ($1,$2,$3,$4,$5,'draft',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [purchaseId, no, input.supplierId, input.supplierInvoiceNo, input.invoiceDate, input.source, input.notes, toRupees(t.subtotal), input.discountTotal,
        toRupees(t.tax), input.otherCharges, toRupees(t.total), input.invoiceImportId, input.stockImportId, actor.id],
    );
    await audit(q, actor, "purchase.created", { type: "purchase", id: purchaseId }, `Draft ${no} (${input.lines.length} line(s), ₹${toRupees(t.total)})`, { source: input.source });
  }
  for (const [i, l] of input.lines.entries()) {
    await q.query(
      `insert into purchase_items (id, purchase_id, line_no, variant_id, new_product, description, qty, unit_cost, tax_rate, tax_amount, line_total, batch_no, mfg_date, expiry_date)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [newId(), purchaseId, i + 1, l.variantId, l.newProduct ? JSON.stringify(l.newProduct) : null, l.description, l.qty, l.unitCost, l.taxRate,
        toRupees(t.per[i].tax), toRupees(t.per[i].total), l.batchNo, l.mfgDate, l.expiryDate],
    );
  }
  return (await getPurchase(q, purchaseId!))!;
}

/** Finds a confirmed purchase with the same supplier + invoice number. */
export async function findDuplicateInvoice(q: Queryable, supplierId: string, invoiceNo: string, exceptId?: string) {
  if (!invoiceNo.trim()) return null;
  const rows = await q.query<{ id: string; purchase_no: string; confirmed_at: string }>(
    `select id, purchase_no, confirmed_at from purchases
     where supplier_id = $1 and lower(supplier_invoice_no) = lower($2) and status = 'confirmed' and id <> coalesce($3, '')
     limit 1`,
    [supplierId, invoiceNo.trim(), exceptId ?? null],
  );
  return rows[0] ?? null;
}

async function createProductFromDraft(q: Queryable, actor: Actor, np: NewProductDraft, supplierId: string) {
  // Never duplicate a product whose SKU/barcode already exists.
  if (np.sku || np.barcode) {
    const hit = await q.query<{ id: string }>(
      "select id from product_variants where (upper(coalesce(sku,'')) = $1 and $1 <> '') or (coalesce(barcode,'') = $2 and $2 <> '') limit 1",
      [np.sku?.toUpperCase() ?? "", np.barcode ?? ""],
    );
    if (hit[0]) return hit[0].id;
  }
  // Same product (name+brand) may exist with a different size → add the size as a new variant.
  const existing = await q.query<{ id: string }>("select id from products where lower(name) = lower($1) and lower(brand) = lower($2) and status <> 'archived' limit 1", [np.name, np.brand]);
  let productId = existing[0]?.id;
  if (!productId) {
    productId = newId();
    let slug = slugify(np.name.toLowerCase().startsWith(np.brand.toLowerCase()) ? np.name : `${np.brand} ${np.name}`) || productId.slice(0, 8);
    while ((await q.query("select 1 from products where slug = $1", [slug])).length) slug = `${slug}-${Math.random().toString(36).slice(2, 5)}`;
    await q.query(
      `insert into products (id, slug, name, brand, category, status, image_status, hsn, gst_rate, default_supplier_id)
       values ($1,$2,$3,$4,$5,'draft','IMAGE_PENDING',$6,$7,$8)`,
      [productId, slug, np.name, np.brand, np.category, np.hsn ?? "", np.gstRate ?? null, supplierId],
    );
    await audit(q, actor, "product.created", { type: "product", id: productId }, `Created draft product ${np.brand} ${np.name} from a purchase (image pending, not published)`);
  }
  const codeBase = slugify(np.flavour ? `${np.label} ${np.flavour}` : np.label) || "default";
  let code = codeBase;
  while ((await q.query("select 1 from product_variants where product_id = $1 and code = $2", [productId, code])).length) code += "-x";
  const vid = newId();
  await q.query(
    `insert into product_variants (id, product_id, code, label, flavour, sku, barcode, price, mrp, stock)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,0)`,
    [vid, productId, code, np.label, np.flavour ?? "", np.sku || null, np.barcode || null, np.price, Math.max(np.mrp ?? 0, np.price)],
  );
  return vid;
}

/**
 * Confirms a draft: creates any new products (as unpublished drafts with IMAGE_PENDING), receives
 * every line into stock with a batch, updates weighted-average costs, and audits. All-or-nothing.
 */
export async function confirmPurchase(q: Queryable, actor: Actor, id: string, opts: { overrideDuplicateReason?: string } = {}) {
  if (!can(actor.role, "purchases.confirm")) throw forbidden("You can't confirm stock receipts");
  const rows = await q.query<{ id: string; status: string; supplier_id: string; supplier_invoice_no: string; purchase_no: string; total: number }>(
    "select id, status, supplier_id, supplier_invoice_no, purchase_no, total from purchases where id = $1 for update",
    [id],
  );
  const p = rows[0];
  if (!p) throw notFound("Purchase not found");
  if (p.status === "confirmed") return { purchase: (await getPurchase(q, id))!, duplicate: true };
  if (p.status !== "draft") throw conflict("This purchase was cancelled");

  let overrideReason: string | null = null;
  const dup = await findDuplicateInvoice(q, p.supplier_id, p.supplier_invoice_no, id);
  if (dup) {
    const reason = (opts.overrideDuplicateReason ?? "").trim();
    if (!reason) {
      throw conflict(`Supplier invoice ${p.supplier_invoice_no} was already received in ${dup.purchase_no}. Receiving it again would double the stock.`, {
        code: "DUPLICATE_INVOICE",
        duplicateOf: dup.purchase_no,
        duplicateId: dup.id,
      });
    }
    if (!can(actor.role, "purchases.override_duplicate")) throw forbidden("Only the owner can receive the same supplier invoice twice");
    if (reason.length < 5) throw bad("Explain why this invoice is being received again (at least 5 characters)");
    overrideReason = reason.slice(0, 300);
  }

  const settings = await getSettings(q);
  const items = await q.query<{ id: string; variant_id: string | null; new_product: NewProductDraft | null; qty: number; unit_cost: number; tax_rate: number | null; batch_no: string; mfg_date: string | null; expiry_date: string | null }>(
    "select id, variant_id, new_product, qty, unit_cost, tax_rate, batch_no, mfg_date, expiry_date from purchase_items where purchase_id = $1 order by line_no",
    [id],
  );
  if (!items.length) throw bad("This purchase has no lines");

  const done = await q.query("update purchases set status='confirmed', confirmed_by=$2, confirmed_at=now(), duplicate_override_reason=$3, updated_at=now() where id=$1 and status='draft' returning id", [
    id,
    actor.id,
    overrideReason,
  ]);
  if (!done.length) return { purchase: (await getPurchase(q, id))!, duplicate: true };

  let units = 0;
  for (const it of items) {
    const variantId = it.variant_id ?? (await createProductFromDraft(q, actor, it.new_product!, p.supplier_id));
    // Cost basis: registered businesses claim GST back, so cost excludes it; otherwise GST paid is part of cost.
    const cost = !settings.business.gstRegistered && it.tax_rate ? Math.round(it.unit_cost * (1 + it.tax_rate / 100) * 100) / 100 : it.unit_cost;
    const { batchId } = await receiveStock(q, {
      variantId,
      qty: it.qty,
      unitCost: cost,
      batchNo: it.batch_no,
      mfgDate: it.mfg_date,
      expiryDate: it.expiry_date,
      purchaseId: id,
      supplierId: p.supplier_id,
      refType: "purchase",
      refId: id,
      refLine: it.id,
      actor,
      note: p.purchase_no,
    });
    await q.query("update purchase_items set variant_id = $2, batch_id = $3 where id = $1", [it.id, variantId, batchId]);
    await q.query("update products set default_supplier_id = coalesce(default_supplier_id, $2) where id = (select product_id from product_variants where id = $1)", [variantId, p.supplier_id]);
    units += it.qty;
  }
  await audit(q, actor, "purchase.confirmed", { type: "purchase", id }, `Received ${p.purchase_no}: ${units} unit(s), ₹${p.total}${p.supplier_invoice_no ? ` · invoice ${p.supplier_invoice_no}` : ""}`, {
    lines: items.length,
    units,
  });
  if (overrideReason) {
    await audit(q, actor, "purchase.duplicate_override", { type: "purchase", id }, `Duplicate invoice ${p.supplier_invoice_no} received again: ${overrideReason}`, { duplicateOf: dup?.purchase_no });
  }
  return { purchase: (await getPurchase(q, id))!, duplicate: false };
}

export async function cancelDraft(q: Queryable, actor: Actor, id: string) {
  const r = await q.query<{ purchase_no: string }>("update purchases set status='cancelled', updated_at=now() where id=$1 and status='draft' returning purchase_no", [id]);
  if (!r[0]) throw conflict("Only draft purchases can be cancelled");
  await audit(q, actor, "purchase.cancelled", { type: "purchase", id }, `Cancelled draft ${r[0].purchase_no}`);
}

/** Records a payment to the supplier against a confirmed purchase (for payables tracking). */
export async function recordSupplierPayment(q: Queryable, actor: Actor, id: string, amount: number) {
  if (!can(actor.role, "purchases.confirm") || actor.role === "inventory") throw forbidden();
  const a = Math.round(Number(amount) * 100) / 100;
  if (!(a > 0)) throw bad("Enter the amount paid");
  const r = await q.query<{ purchase_no: string; paid_amount: number; total: number }>(
    "update purchases set paid_amount = least(total, paid_amount + $2), updated_at = now() where id = $1 and status = 'confirmed' returning purchase_no, paid_amount, total",
    [id, a],
  );
  if (!r[0]) throw conflict("Payments can only be recorded on confirmed purchases");
  await audit(q, actor, "purchase.payment_recorded", { type: "purchase", id }, `Paid ₹${a} to supplier for ${r[0].purchase_no} (now ₹${r[0].paid_amount} of ₹${r[0].total})`);
}

export interface PurchaseView {
  id: string;
  purchase_no: string;
  supplier_id: string;
  supplier_name: string;
  supplier_invoice_no: string;
  invoice_date: string | null;
  status: string;
  source: string;
  notes: string;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  other_charges: number;
  total: number;
  paid_amount: number;
  duplicate_override_reason: string | null;
  created_by_name: string | null;
  created_at: string;
  confirmed_by_name: string | null;
  confirmed_at: string | null;
  invoice_import_id: string | null;
  items: {
    id: string;
    line_no: number;
    variant_id: string | null;
    new_product: NewProductDraft | null;
    product_name: string | null;
    label: string | null;
    flavour: string | null;
    sku: string | null;
    description: string;
    qty: number;
    unit_cost: number;
    tax_rate: number | null;
    tax_amount: number;
    line_total: number;
    batch_no: string;
    mfg_date: string | null;
    expiry_date: string | null;
  }[];
}

export async function getPurchase(q: Queryable, id: string): Promise<PurchaseView | null> {
  const rows = await q.query<Omit<PurchaseView, "items">>(
    `select p.id, p.purchase_no, p.supplier_id, s.name as supplier_name, p.supplier_invoice_no, p.invoice_date, p.status, p.source, p.notes,
            p.subtotal, p.discount_total, p.tax_total, p.other_charges, p.total, p.paid_amount, p.duplicate_override_reason,
            cb.name as created_by_name, p.created_at, fb.name as confirmed_by_name, p.confirmed_at, p.invoice_import_id
     from purchases p join suppliers s on s.id = p.supplier_id
     left join staff cb on cb.id = p.created_by left join staff fb on fb.id = p.confirmed_by
     where p.id = $1 or p.purchase_no = $1`,
    [id],
  );
  if (!rows[0]) return null;
  const items = await q.query<PurchaseView["items"][number]>(
    `select i.id, i.line_no, i.variant_id, i.new_product, pr.name as product_name, v.label, v.flavour, v.sku, i.description, i.qty, i.unit_cost,
            i.tax_rate, i.tax_amount, i.line_total, i.batch_no, i.mfg_date, i.expiry_date
     from purchase_items i left join product_variants v on v.id = i.variant_id left join products pr on pr.id = v.product_id
     where i.purchase_id = $1 order by i.line_no`,
    [rows[0].id],
  );
  return { ...rows[0], items };
}

export async function listPurchases(q: Queryable, f: { status?: string; supplierId?: string; from?: string; to?: string; search?: string; limit?: number } = {}) {
  const w = whereBuilder();
  if (f.status) w.add("p.status = ?", f.status);
  if (f.supplierId) w.add("p.supplier_id = ?", f.supplierId);
  if (f.from) w.add("ist_date(p.created_at) >= ?::date", f.from);
  if (f.to) w.add("ist_date(p.created_at) <= ?::date", f.to);
  if (f.search) {
    const s = `%${f.search.trim()}%`;
    w.add("(p.purchase_no ilike ? or p.supplier_invoice_no ilike ? or s.name ilike ?)", s, s, s);
  }
  const limit = w.param(Math.min(f.limit ?? 100, 500));
  return q.query<{
    id: string;
    purchase_no: string;
    supplier_name: string;
    supplier_invoice_no: string;
    status: string;
    source: string;
    total: number;
    paid_amount: number;
    lines: number;
    units: number;
    created_at: string;
    confirmed_at: string | null;
  }>(
    `select p.id, p.purchase_no, s.name as supplier_name, p.supplier_invoice_no, p.status, p.source, p.total, p.paid_amount,
            (select count(*) from purchase_items i where i.purchase_id = p.id)::int as lines,
            (select coalesce(sum(i.qty),0) from purchase_items i where i.purchase_id = p.id)::int as units,
            p.created_at, p.confirmed_at
     from purchases p join suppliers s on s.id = p.supplier_id ${w.sql}
     order by p.created_at desc limit ${limit}`,
    w.params,
  );
}
