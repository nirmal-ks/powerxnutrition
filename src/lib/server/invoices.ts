import type { Db, Queryable } from "@/lib/db/adapter";
import { newId } from "@/lib/db/ids";
import { emptyInvoice, type ExtractedInvoice, type InvoiceReview, type InvoiceWarning } from "@/lib/invoice-types";
import { can, type Actor } from "@/lib/permissions";
import { audit } from "./audit";
import { bad, conflict, forbidden, notFound } from "./errors";
import { aiProvider, checkInvoice, extractWithAi, parseInvoiceText, type ProviderId } from "./invoice-extract";
import { loadCatalogVariants, matchAgainst } from "./product-match";
import { confirmPurchase, findDuplicateInvoice, savePurchaseDraft } from "./purchases";
import { getSettings } from "./settings";
import { supplierKey } from "./suppliers";

/**
 * Supplier invoice workflow:
 *   upload (private storage) → extract (AI if configured AND allowed by the owner, else text/OCR,
 *   else manual) → match products → staff review & correct → confirm → purchase receipt + stock.
 * Nothing touches inventory until the final confirm.
 */

export const MAX_INVOICE_BYTES = 10 * 1024 * 1024;
export const INVOICE_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

export interface InvoiceImportRow {
  id: string;
  status: string;
  file_name: string;
  mime: string;
  size_bytes: number;
  file_path: string;
  file_hash: string;
  provider: string;
  extracted: ExtractedInvoice | null;
  review: InvoiceReview | null;
  warnings: InvoiceWarning[] | null;
  supplier_id: string | null;
  invoice_no: string;
  purchase_id: string | null;
  error: string | null;
  created_by: string | null;
  created_at: string;
}

export async function registerUpload(
  q: Queryable,
  actor: Actor,
  f: { fileName: string; mime: string; size: number; storedPath: string; hash: string },
) {
  if (!can(actor.role, "purchases.create")) throw forbidden();
  const dupFile = await q.query<{ id: string; status: string; created_at: string }>(
    "select id, status, created_at from invoice_imports where file_hash = $1 and status <> 'discarded' order by created_at desc limit 1",
    [f.hash],
  );
  const id = newId();
  await q.query(
    `insert into invoice_imports (id, status, file_path, file_name, mime, size_bytes, file_hash, created_by) values ($1,'uploaded',$2,$3,$4,$5,$6,$7)`,
    [id, f.storedPath, f.fileName.slice(0, 120), f.mime, f.size, f.hash, actor.id],
  );
  await audit(q, actor, "invoice.uploaded", { type: "invoice_import", id }, `Uploaded supplier invoice ${f.fileName}`);
  return { id, sameFileAs: dupFile[0] ?? null };
}

/** Builds the editable review from an extraction: matches suppliers & products, never invents values. */
export async function buildReview(q: Queryable, inv: ExtractedInvoice): Promise<InvoiceReview> {
  const suppliers = await q.query<{ id: string; name_key: string; gstin: string }>("select id, name_key, gstin from suppliers where active");
  const gstin = inv.supplierGstin.value?.toUpperCase();
  const byGstin = gstin ? suppliers.find((s) => s.gstin && s.gstin.toUpperCase() === gstin) : undefined;
  const byName = inv.supplierName.value ? suppliers.find((s) => s.name_key === supplierKey(inv.supplierName.value!)) : undefined;
  const catalog = await loadCatalogVariants(q);
  return {
    supplierId: byGstin?.id ?? byName?.id ?? null,
    invoiceNo: inv.invoiceNo.value ?? "",
    invoiceDate: inv.invoiceDate.value ?? "",
    discountTotal: inv.discountTotal.value ?? 0,
    otherCharges: 0,
    notes: "",
    invoiceTotal: inv.total.value,
    lines: inv.lines.map((l) => {
      const m = matchAgainst(catalog, {
        sku: l.sku.value ?? undefined,
        barcode: l.barcode.value ?? undefined,
        brand: l.brand.value ?? "",
        name: l.name.value ?? "",
        size: l.size.value ?? undefined,
        flavour: l.flavour.value ?? undefined,
      });
      const label = (c: { brand: string; name: string; label: string; flavour: string }) => `${c.brand} ${c.name} · ${c.label}${c.flavour ? ` · ${c.flavour}` : ""}`;
      return {
        action: m.match ? ("existing" as const) : m.candidates.length ? ("existing" as const) : ("new" as const),
        variantId: m.match?.variant_id ?? null,
        newProduct: m.match || m.candidates.length
          ? null
          : {
              name: l.name.value ?? "",
              brand: l.brand.value ?? "",
              category: "",
              label: l.size.value ?? "",
              flavour: l.flavour.value ?? "",
              sku: l.sku.value ?? "",
              barcode: l.barcode.value ?? "",
              price: 0, // selling price is never taken from a purchase invoice — staff enters it
              mrp: 0,
              gstRate: l.taxRate.value,
              hsn: l.hsn.value ?? "",
            },
        description: [l.brand.value, l.name.value, l.size.value, l.flavour.value].filter(Boolean).join(" "),
        qty: l.qty.value ?? 0,
        unitCost: l.unitPrice.value ?? 0,
        taxRate: l.taxRate.value,
        batchNo: l.batchNo.value ?? "",
        mfgDate: l.mfgDate.value ?? "",
        expiryDate: l.expiryDate.value ?? "",
        candidates: m.candidates.map((c) => ({ variantId: c.variant_id, label: label(c), score: c.result.score, reasons: c.result.reasons })),
      };
    }),
  };
}

/**
 * Runs extraction. `text` comes from the browser (pdf.js text layer or Tesseract OCR) and is used
 * when no AI is configured/allowed, or for AI endpoints that can't read PDFs.
 */
export async function runExtraction(
  db: Db,
  actor: Actor,
  id: string,
  input: { text?: string | null; file?: { bytes: Buffer; mime: string } | null; mode?: "auto" | "text" | "manual" },
  fetchImpl: typeof fetch = fetch,
) {
  const rows = await db.query<InvoiceImportRow>("select * from invoice_imports where id = $1", [id]);
  const imp = rows[0];
  if (!imp) throw notFound("Invoice not found");
  if (imp.status === "confirmed") throw conflict("This invoice was already confirmed");
  const settings = await getSettings(db);
  const p = aiProvider();
  const text = (input.text ?? "").slice(0, 100_000) || null;

  let extracted: ExtractedInvoice;
  let provider: ProviderId = "manual";
  let note: string | null = null;
  const aiAllowed = p && (!p.external || settings.ai.allowExternalInvoiceAi);
  try {
    if (input.mode !== "manual" && input.mode !== "text" && aiAllowed) {
      extracted = await extractWithAi(input.file ?? null, text, fetchImpl);
      provider = p!.id;
    } else if (input.mode !== "manual" && text) {
      extracted = parseInvoiceText(text);
      provider = "text";
      if (p && !aiAllowed) note = "AI is configured but the owner hasn't allowed sending invoices to it (Settings → AI). Used text reading instead.";
    } else {
      extracted = emptyInvoice();
      provider = "manual";
    }
  } catch (e) {
    // AI unavailable / quota exceeded → fall back to text parsing or manual entry, never block the user.
    note = `AI reading failed (${(e as Error).message.slice(0, 160)}). ${text ? "Used basic text reading instead" : "Please enter the details manually"}.`;
    extracted = text ? parseInvoiceText(text) : emptyInvoice();
    provider = text ? "text" : "manual";
  }

  const warnings = checkInvoice(extracted);
  if (note) warnings.unshift({ level: "info", field: "provider", message: note });
  if (provider === "text") warnings.unshift({ level: "info", field: "provider", message: "Read without AI — every value needs checking against the paper invoice." });
  const review = await buildReview(db, extracted);
  if (review.invoiceNo && review.supplierId) {
    const dup = await findDuplicateInvoice(db, review.supplierId, review.invoiceNo);
    if (dup) warnings.unshift({ level: "error", field: "invoiceNo", message: `This invoice number was already received from this supplier in ${dup.purchase_no}. Confirming again would double the stock.` });
  }
  await db.tx(async (q) => {
    await q.query(
      `update invoice_imports set status = 'extracted', provider = $2, raw_text = $3, extracted = $4, review = $5, warnings = $6, supplier_id = $7, invoice_no = $8, error = null, updated_at = now() where id = $1`,
      [id, provider, text, JSON.stringify(extracted), JSON.stringify(review), JSON.stringify(warnings), review.supplierId, review.invoiceNo],
    );
    await audit(q, actor, "invoice.extracted", { type: "invoice_import", id }, `Read ${imp.file_name} with ${provider === "gemini" || provider === "openai" ? p!.label : provider}: ${extracted.lines.length} line(s), ${warnings.filter((w) => w.level === "error").length} issue(s)`);
  });
  return { provider, extracted, review, warnings };
}

/** Totals check on the staff-reviewed lines vs the printed invoice total. */
export function reviewWarnings(r: InvoiceReview): InvoiceWarning[] {
  const w: InvoiceWarning[] = [];
  if (!r.supplierId) w.push({ level: "error", field: "supplierId", message: "Choose or add the supplier" });
  if (!r.invoiceNo.trim()) w.push({ level: "warn", field: "invoiceNo", message: "Invoice number is empty — duplicate detection won't work" });
  const active = r.lines.filter((l) => l.action !== "skip");
  if (!active.length) w.push({ level: "error", field: "lines", message: "No lines to receive" });
  active.forEach((l) => {
    const i = r.lines.indexOf(l);
    if (!Number.isInteger(Number(l.qty)) || Number(l.qty) <= 0) w.push({ level: "error", field: `lines[${i}].qty`, message: `Line ${i + 1}: enter a valid quantity` });
    if (!(Number(l.unitCost) >= 0)) w.push({ level: "error", field: `lines[${i}].unitCost`, message: `Line ${i + 1}: enter the unit cost` });
    if (l.action === "existing" && !l.variantId) w.push({ level: "error", field: `lines[${i}].variantId`, message: `Line ${i + 1}: choose the matching product (check size & flavour) or mark it as new` });
    if (l.action === "new" && (!l.newProduct?.name || !l.newProduct.brand || !l.newProduct.category || !l.newProduct.label || !(Number(l.newProduct.price) > 0))) {
      w.push({ level: "error", field: `lines[${i}].newProduct`, message: `Line ${i + 1}: new product needs name, brand, category, size and selling price` });
    }
  });
  if (r.invoiceTotal !== null && r.invoiceTotal !== undefined) {
    const sum = active.reduce((s, l) => s + Number(l.qty) * Number(l.unitCost) * (1 + (Number(l.taxRate) || 0) / 100), 0) - Number(r.discountTotal || 0) + Number(r.otherCharges || 0);
    if (Math.abs(sum - Number(r.invoiceTotal)) > Math.max(2, Number(r.invoiceTotal) * 0.005)) {
      w.push({ level: "warn", field: "total", message: `Reviewed lines total ₹${sum.toFixed(2)} but the invoice says ₹${Number(r.invoiceTotal).toFixed(2)} — check quantities, prices, GST and discounts` });
    }
  }
  return w;
}

export async function saveReview(q: Queryable, actor: Actor, id: string, review: InvoiceReview) {
  const cur = await q.query<{ status: string; review: InvoiceReview | null }>("select status, review from invoice_imports where id = $1 for update", [id]);
  if (!cur[0]) throw notFound("Invoice not found");
  if (cur[0].status === "confirmed" || cur[0].status === "discarded") throw conflict("This invoice is already finished");
  const clean: InvoiceReview = {
    supplierId: review.supplierId || null,
    invoiceNo: String(review.invoiceNo ?? "").trim().slice(0, 40),
    invoiceDate: /^\d{4}-\d{2}-\d{2}$/.test(String(review.invoiceDate)) ? review.invoiceDate : "",
    discountTotal: Math.max(0, Number(review.discountTotal) || 0),
    otherCharges: Math.max(0, Number(review.otherCharges) || 0),
    notes: String(review.notes ?? "").slice(0, 500),
    invoiceTotal: review.invoiceTotal === null || review.invoiceTotal === undefined || (review.invoiceTotal as unknown) === "" ? null : Number(review.invoiceTotal),
    lines: (review.lines ?? []).slice(0, 300).map((l) => ({ ...l, qty: Number(l.qty), unitCost: Number(l.unitCost), taxRate: l.taxRate === null || (l.taxRate as unknown) === "" ? null : Number(l.taxRate) })),
  };
  const changed = JSON.stringify(cur[0].review) !== JSON.stringify(clean);
  await q.query("update invoice_imports set review = $2, supplier_id = $3, invoice_no = $4, updated_at = now() where id = $1", [id, JSON.stringify(clean), clean.supplierId, clean.invoiceNo]);
  if (changed) await audit(q, actor, "invoice.corrected", { type: "invoice_import", id }, `Reviewed/corrected invoice ${clean.invoiceNo || id.slice(0, 8)}`);
  return { review: clean, warnings: reviewWarnings(clean) };
}

/** Final step: creates and confirms the purchase (stock goes up) in one transaction. */
export async function confirmInvoice(db: Db, actor: Actor, id: string, opts: { overrideDuplicateReason?: string } = {}) {
  if (!can(actor.role, "purchases.confirm")) throw forbidden("You can't confirm stock receipts");
  return db.tx(async (q) => {
    const cur = await q.query<InvoiceImportRow>("select * from invoice_imports where id = $1 for update", [id]);
    const imp = cur[0];
    if (!imp) throw notFound("Invoice not found");
    if (imp.status === "confirmed") return { duplicate: true, purchaseId: imp.purchase_id };
    if (imp.status !== "extracted") throw conflict("Read/enter the invoice details first");
    const r = imp.review!;
    const errors = reviewWarnings(r).filter((w) => w.level === "error");
    if (errors.length) throw bad(errors.map((e) => e.message).join(" · "));
    const draft = await savePurchaseDraft(q, actor, {
      supplierId: r.supplierId!,
      supplierInvoiceNo: r.invoiceNo,
      invoiceDate: r.invoiceDate || null,
      notes: r.notes || `From invoice ${imp.file_name}`,
      discountTotal: r.discountTotal,
      otherCharges: r.otherCharges,
      source: "invoice",
      invoiceImportId: id,
      lines: r.lines
        .filter((l) => l.action !== "skip")
        .map((l) => ({
          variantId: l.action === "existing" ? l.variantId : null,
          newProduct: l.action === "new" ? l.newProduct : null,
          description: l.description,
          qty: l.qty,
          unitCost: l.unitCost,
          taxRate: l.taxRate,
          batchNo: l.batchNo,
          mfgDate: l.mfgDate || null,
          expiryDate: l.expiryDate || null,
        })),
    });
    await confirmPurchase(q, actor, draft.id, opts);
    await q.query("update invoice_imports set status = 'confirmed', purchase_id = $2, updated_at = now() where id = $1", [id, draft.id]);
    await audit(q, actor, "invoice.confirmed", { type: "invoice_import", id }, `Invoice ${r.invoiceNo || imp.file_name} received as ${draft.purchase_no}`);
    return { duplicate: false, purchaseId: draft.id, purchaseNo: draft.purchase_no };
  });
}

export async function discardInvoice(q: Queryable, actor: Actor, id: string) {
  const r = await q.query<{ file_name: string }>("update invoice_imports set status = 'discarded', updated_at = now() where id = $1 and status <> 'confirmed' returning file_name", [id]);
  if (!r[0]) throw conflict("Confirmed invoices can't be discarded");
  await audit(q, actor, "invoice.discarded", { type: "invoice_import", id }, `Discarded invoice ${r[0].file_name}`);
}

export async function listInvoiceImports(q: Queryable) {
  return q.query<{ id: string; status: string; file_name: string; provider: string; invoice_no: string; supplier_name: string | null; purchase_no: string | null; created_at: string; lines: number; issues: number }>(
    `select i.id, i.status, i.file_name, i.provider, i.invoice_no, s.name as supplier_name, p.purchase_no, i.created_at,
            coalesce(jsonb_array_length(i.review->'lines'), 0)::int as lines,
            coalesce((select count(*) from jsonb_array_elements(i.warnings) w where w->>'level' = 'error'), 0)::int as issues
     from invoice_imports i left join suppliers s on s.id = i.supplier_id left join purchases p on p.id = i.purchase_id
     where i.status <> 'discarded' order by i.created_at desc limit 100`,
  );
}
