"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/format";
import { LOW_CONFIDENCE, type ExtractedInvoice, type Field, type InvoiceReview, type InvoiceWarning } from "@/lib/invoice-types";
import { inr2 } from "@/lib/money";
import type { InvoiceImportRow } from "@/lib/server/invoices";
import { TrashIcon } from "../../ui/Icons";
import { ProductLookup } from "../purchases/ProductLookup";
import { SupplierPicker, type SupplierOption } from "../purchases/SupplierPicker";
import { useCan } from "../SessionContext";
import { Alert, api, type ApiError, Badge, Card, labelCls, Spinner } from "../ui";
import { readFileText } from "./browserText";

type Inv = Omit<InvoiceImportRow, "file_path">;
type ReviewLine = InvoiceReview["lines"][number];

const conf = (f?: Field<unknown> | null) =>
  !f || f.value === null ? null : f.confidence === null ? <Badge>no score</Badge> : f.confidence < LOW_CONFIDENCE ? <Badge tone="red">{Math.round(f.confidence * 100)}% check</Badge> : <Badge tone="green">{Math.round(f.confidence * 100)}%</Badge>;

export function InvoiceReviewScreen({
  invoice: initial,
  initialReviewWarnings,
  suppliers: initialSuppliers,
  categories,
  ai,
  sameFileAs,
}: {
  invoice: Inv;
  initialReviewWarnings: InvoiceWarning[];
  suppliers: SupplierOption[];
  categories: { slug: string; name: string }[];
  ai: { label: string; allowed: boolean; kind: string } | null;
  sameFileAs: string | null;
}) {
  const router = useRouter();
  const can = useCan();
  const [inv, setInv] = useState(initial);
  const [review, setReview] = useState<InvoiceReview | null>(initial.review);
  const [warnings, setWarnings] = useState<InvoiceWarning[]>(initial.warnings ?? []);
  const [rw, setRw] = useState<InvoiceWarning[]>(initialReviewWarnings);
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [busy, setBusy] = useState("");
  const [progress, setProgress] = useState("");
  const [err, setErr] = useState("");
  const [dupOf, setDupOf] = useState("");
  const [reason, setReason] = useState("");
  const [showFile, setShowFile] = useState(true);
  const fileUrl = `/api/admin/invoices/${inv.id}/file`;
  const ex = inv.extracted as ExtractedInvoice | null;
  const done = inv.status === "confirmed";

  const extract = async (mode: "auto" | "text" | "manual") => {
    setBusy("extract");
    setErr("");
    try {
      let text: string | undefined;
      // no-AI path, or AI endpoints that can't read PDFs: read the text in the browser (free)
      if (mode === "text" || (mode === "auto" && (!ai?.allowed || (ai.kind === "openai" && inv.mime === "application/pdf")))) {
        const blob = await (await fetch(fileUrl)).blob();
        text = await readFileText(blob, inv.mime, setProgress);
        if (mode === "auto" && !ai?.allowed) mode = "text";
      }
      setProgress(mode === "auto" && ai?.allowed ? `Reading with ${ai.label}…` : "Matching products…");
      const d = await api<{ review: InvoiceReview; warnings: InvoiceWarning[]; extracted: ExtractedInvoice; provider: string }>(`/api/admin/invoices/${inv.id}`, {
        method: "POST",
        json: { action: "extract", mode, text },
      });
      setReview(d.review);
      setWarnings(d.warnings);
      setInv((x) => ({ ...x, status: "extracted", extracted: d.extracted, provider: d.provider }));
      const s = await api<{ warnings: InvoiceWarning[] }>(`/api/admin/invoices/${inv.id}`, { method: "PATCH", json: { review: d.review } });
      setRw(s.warnings);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy("");
      setProgress("");
    }
  };

  const save = async (r: InvoiceReview) => {
    setReview(r);
    try {
      const d = await api<{ review: InvoiceReview; warnings: InvoiceWarning[] }>(`/api/admin/invoices/${inv.id}`, { method: "PATCH", json: { review: r } });
      setRw(d.warnings);
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const setLine = (i: number, patch: Partial<ReviewLine>) => review && setReview({ ...review, lines: review.lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) });
  const commitLine = (i: number, patch: Partial<ReviewLine>) => review && save({ ...review, lines: review.lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) });

  const confirm = async () => {
    if (!review) return;
    setBusy("confirm");
    setErr("");
    try {
      await save(review);
      const d = await api<{ purchaseId: string }>(`/api/admin/invoices/${inv.id}`, { method: "POST", json: { action: "confirm", overrideDuplicateReason: dupOf ? reason : undefined } });
      router.push(`/admin/purchases/${d.purchaseId}?saved=confirmed`);
    } catch (e) {
      const ae = e as ApiError;
      if (ae.data?.code === "DUPLICATE_INVOICE") setDupOf(String(ae.data.duplicateOf));
      setErr(ae.message);
      setBusy("");
    }
  };

  const discard = async () => {
    if (!window.confirm("Discard this invoice? Nothing was added to stock.")) return;
    await api(`/api/admin/invoices/${inv.id}`, { method: "POST", json: { action: "discard" } });
    router.push("/admin/purchases/import-invoice");
  };

  const errors = rw.filter((w) => w.level === "error");
  const sum = review?.lines.filter((l) => l.action !== "skip").reduce((s, l) => s + Number(l.qty) * Number(l.unitCost) * (1 + (Number(l.taxRate) || 0) / 100), 0) ?? 0;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <Link href="/admin/purchases/import-invoice" className="text-xs font-bold uppercase tracking-widest text-smoke hover:text-white">← Invoices</Link>
          <h1 className="font-display text-3xl">Review invoice</h1>
          <p className="text-xs text-smoke">{inv.file_name} · {inv.provider ? `read by ${inv.provider}` : "not read yet"}</p>
        </div>
        <button onClick={() => setShowFile((v) => !v)} className="btn btn-ghost px-3! py-2! text-xs!">{showFile ? "Hide" : "Show"} invoice</button>
      </div>
      {sameFileAs && <Alert tone="warn" className="mb-3">This exact file was uploaded before. <Link className="underline" href={`/admin/purchases/import-invoice/${sameFileAs}`}>Open the earlier upload</Link> — don&apos;t receive the same delivery twice.</Alert>}
      {done && <Alert tone="ok" className="mb-3">This invoice was received into stock. {inv.purchase_id && <Link className="underline" href={`/admin/purchases/${inv.purchase_id}`}>Open the purchase</Link>}</Alert>}

      <div className={cn("grid gap-4", showFile && "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]")}>
        {showFile && (
          <div className="lg:sticky lg:top-4 lg:self-start">
            {inv.mime === "application/pdf" ? (
              <iframe src={fileUrl} className="h-[70vh] w-full rounded-2xl border border-white/10 bg-white" title="Supplier invoice" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fileUrl} alt="Supplier invoice" className="w-full rounded-2xl border border-white/10 bg-white" />
            )}
          </div>
        )}

        <div className="space-y-4">
          {!review && !done && (
            <Card title="Read the invoice">
              <div className="grid gap-2">
                {ai?.allowed && <button onClick={() => extract("auto")} disabled={!!busy} className="btn btn-red py-3.5!">{busy && <Spinner />} Read with AI ({ai.label})</button>}
                <button onClick={() => extract("text")} disabled={!!busy} className={cn("btn py-3.5!", ai?.allowed ? "btn-ghost" : "btn-red")}>Read text without AI (free)</button>
                <button onClick={() => extract("manual")} disabled={!!busy} className="btn btn-ghost py-3!">Type it in myself</button>
              </div>
              {progress && <p className="mt-3 text-sm text-gold"><Spinner /> {progress}</p>}
              {err && <Alert className="mt-3">{err}</Alert>}
            </Card>
          )}

          {review && (
            <>
              {warnings.length > 0 && (
                <Card title="What to check">
                  <ul className="space-y-1 text-sm">
                    {warnings.map((w, i) => (
                      <li key={i} className={w.level === "error" ? "text-ember" : w.level === "warn" ? "text-gold" : "text-zinc-400"}>
                        {w.level === "error" ? "✖" : w.level === "warn" ? "⚠" : "ℹ"} {w.message}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[0.7rem] text-smoke">Values are never changed automatically — compare with the invoice on the left and correct below.</p>
                </Card>
              )}

              <Card title="Invoice details">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <span className={labelCls}>Supplier {ex?.supplierName.value && <span className="normal-case text-smoke">(read: “{ex.supplierName.value}”{ex.supplierGstin.value ? ` · GSTIN ${ex.supplierGstin.value}` : ""}) {conf(ex.supplierName)}</span>}</span>
                    <SupplierPicker suppliers={suppliers} value={review.supplierId ?? ""} onChange={(id) => save({ ...review, supplierId: id || null })} onCreated={(s) => setSuppliers((x) => [...x, s])} />
                  </div>
                  <label className="block">
                    <span className={labelCls}>Invoice no. {conf(ex?.invoiceNo)}</span>
                    <input value={review.invoiceNo} onChange={(e) => setReview({ ...review, invoiceNo: e.target.value })} onBlur={() => save(review)} className="input" disabled={done} />
                  </label>
                  <label className="block">
                    <span className={labelCls}>Invoice date {conf(ex?.invoiceDate)}</span>
                    <input type="date" value={review.invoiceDate} onChange={(e) => save({ ...review, invoiceDate: e.target.value })} className="input" disabled={done} />
                  </label>
                  <label className="block">
                    <span className={labelCls}>Invoice total (printed) {conf(ex?.total)}</span>
                    <input value={review.invoiceTotal ?? ""} onChange={(e) => setReview({ ...review, invoiceTotal: e.target.value === "" ? null : Number(e.target.value.replace(/[^\d.]/g, "")) })} onBlur={() => save(review)} inputMode="decimal" className="input" disabled={done} />
                  </label>
                  <label className="block">
                    <span className={labelCls}>Discount on invoice</span>
                    <input value={review.discountTotal || ""} onChange={(e) => setReview({ ...review, discountTotal: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 })} onBlur={() => save(review)} inputMode="decimal" className="input" disabled={done} />
                  </label>
                </div>
              </Card>

              <Card title={`Lines (${review.lines.length})`}>
                <ul className="space-y-3">
                  {review.lines.map((l, i) => {
                    const exl = ex?.lines[i];
                    return (
                      <li key={i} className={cn("rounded-2xl border p-3 text-sm", l.action === "skip" ? "border-white/5 opacity-50" : l.action === "new" ? "border-gold/40" : "border-white/10")}>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="font-semibold">{i + 1}. {l.description || "(no description)"} {exl && conf(exl.name)}</p>
                          <div className="flex gap-1">
                            {(["existing", "new", "skip"] as const).map((a) => (
                              <button key={a} disabled={done} onClick={() => commitLine(i, { action: a, newProduct: a === "new" && !l.newProduct ? { name: exl?.name.value ?? "", brand: exl?.brand.value ?? "", category: "", label: exl?.size.value ?? "", flavour: exl?.flavour.value ?? "", sku: exl?.sku.value ?? "", barcode: exl?.barcode.value ?? "", price: 0, mrp: 0, gstRate: l.taxRate, hsn: exl?.hsn.value ?? "" } : l.newProduct })} className={cn("rounded-lg border px-2 py-1 text-[0.7rem] font-bold", l.action === a ? "border-gold text-gold" : "border-white/10 text-zinc-500")}>
                                {a === "existing" ? "Existing" : a === "new" ? "New product" : "Skip"}
                              </button>
                            ))}
                          </div>
                        </div>
                        {l.action === "existing" && (
                          <div className="mt-2 space-y-1">
                            {l.candidates && l.candidates.length > 0 && (
                              <select value={l.variantId ?? ""} onChange={(e) => commitLine(i, { variantId: e.target.value || null })} className="input py-2! text-xs" disabled={done}>
                                <option value="" className="bg-coal">— Choose the exact product (size & flavour must match) —</option>
                                {l.candidates.map((c) => <option key={c.variantId} value={c.variantId} className="bg-coal">{c.label} — {c.score}%{c.reasons.length ? ` (${c.reasons.join(", ")})` : ""}</option>)}
                              </select>
                            )}
                            {!done && <ProductLookup onPick={(v) => commitLine(i, { variantId: v.variant_id, candidates: [{ variantId: v.variant_id, label: `${v.brand} ${v.name} · ${v.label}${v.flavour ? ` · ${v.flavour}` : ""}`, score: 100, reasons: ["chosen by staff"] }, ...(l.candidates ?? [])] })} placeholder="…or search another product" />}
                            {!l.variantId && <p className="text-xs text-ember">Choose the matching product, or mark it as a new product.</p>}
                          </div>
                        )}
                        {l.action === "new" && l.newProduct && (
                          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {(["brand", "name", "label", "flavour", "sku", "barcode"] as const).map((k) => (
                              <input key={k} value={l.newProduct![k]} onChange={(e) => setLine(i, { newProduct: { ...l.newProduct!, [k]: e.target.value } })} onBlur={() => save(review)} placeholder={k === "label" ? "Size *" : k === "name" ? "Name *" : k === "brand" ? "Brand *" : k} className="input py-1.5! text-xs" disabled={done} />
                            ))}
                            <select value={l.newProduct.category} onChange={(e) => commitLine(i, { newProduct: { ...l.newProduct!, category: e.target.value } })} className="input py-1.5! text-xs" disabled={done}>
                              <option value="" className="bg-coal">Category *</option>
                              {categories.map((c) => <option key={c.slug} value={c.slug} className="bg-coal">{c.name}</option>)}
                            </select>
                            <input value={l.newProduct.price || ""} onChange={(e) => setLine(i, { newProduct: { ...l.newProduct!, price: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 } })} onBlur={() => save(review)} placeholder="Selling price ₹ *" inputMode="decimal" className="input py-1.5! text-xs" disabled={done} />
                          </div>
                        )}
                        {l.action !== "skip" && (
                          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
                            <Num label="Qty" f={exl?.qty} value={l.qty} onChange={(v) => setLine(i, { qty: v === "" ? 0 : v })} onBlur={() => save(review)} disabled={done} />
                            <Num label="Unit cost" f={exl?.unitPrice} value={l.unitCost} onChange={(v) => setLine(i, { unitCost: v === "" ? 0 : v })} onBlur={() => save(review)} disabled={done} />
                            <Num label="GST %" f={exl?.taxRate} value={l.taxRate ?? ""} onChange={(v) => setLine(i, { taxRate: v === "" ? null : Number(v) })} onBlur={() => save(review)} disabled={done} />
                            <Txt label="Batch" value={l.batchNo} onChange={(v) => setLine(i, { batchNo: v })} onBlur={() => save(review)} disabled={done} />
                            <Txt label="Expiry" type="date" value={l.expiryDate} onChange={(v) => setLine(i, { expiryDate: v })} onBlur={() => save(review)} disabled={done} />
                            <div className="text-right text-xs">
                              <span className="block text-[0.6rem] text-smoke">Line total</span>
                              <b>{inr2(Number(l.qty) * Number(l.unitCost) * (1 + (Number(l.taxRate) || 0) / 100))}</b>
                              {exl?.lineTotal.value != null && <span className="block text-[0.65rem] text-smoke">invoice: {inr2(exl.lineTotal.value)}</span>}
                            </div>
                          </div>
                        )}
                        {!done && (
                          <button onClick={() => save({ ...review, lines: review.lines.filter((_, idx) => idx !== i) })} className="mt-1 text-[0.7rem] text-smoke hover:text-ember"><TrashIcon size={12} className="inline" /> remove line</button>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {!done && (
                  <button
                    onClick={() => save({ ...review, lines: [...review.lines, { action: "existing", variantId: null, newProduct: null, description: "Added manually", qty: 1, unitCost: 0, taxRate: null, batchNo: "", mfgDate: "", expiryDate: "", candidates: [] }] })}
                    className="btn btn-ghost mt-3 w-full py-2.5! text-xs!"
                  >
                    + Add a line the reader missed
                  </button>
                )}
              </Card>

              {!done && (
                <div className="sticky bottom-0 z-10 -mx-3 space-y-2 border-t border-white/10 bg-[#0b0b0d]/95 px-3 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
                  <p className="flex justify-between text-sm">
                    <span>Reviewed total</span>
                    <b className={cn(review.invoiceTotal !== null && Math.abs(sum - Number(review.discountTotal || 0) - Number(review.invoiceTotal)) > 2 ? "text-gold" : "text-green-300")}>
                      {inr2(sum - Number(review.discountTotal || 0))}{review.invoiceTotal !== null ? ` / invoice ${inr2(Number(review.invoiceTotal))}` : ""}
                    </b>
                  </p>
                  {rw.filter((w) => w.level !== "info").map((w, i) => <p key={i} className={cn("text-xs", w.level === "error" ? "text-ember" : "text-gold")}>{w.message}</p>)}
                  {err && <Alert>{err}</Alert>}
                  {dupOf && can("purchases.override_duplicate") && <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={`Reason to receive again (already in ${dupOf})`} className="input" />}
                  <div className="flex gap-2">
                    <button onClick={discard} className="btn btn-ghost flex-1">Discard</button>
                    <button onClick={() => extract(ai?.allowed ? "auto" : "text")} disabled={!!busy} className="btn btn-ghost flex-1">Re-read</button>
                    <button onClick={confirm} disabled={!!busy || errors.length > 0 || !can("purchases.confirm") || (Boolean(dupOf) && reason.trim().length < 5)} className="btn btn-red flex-[2]">
                      {busy === "confirm" && <Spinner />} Confirm & add to stock
                    </button>
                  </div>
                  {progress && <p className="text-xs text-gold">{progress}</p>}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Num({ label, f, value, onChange, onBlur, disabled }: { label: string; f?: Field<number>; value: number | string; onChange: (v: number | "") => void; onBlur: () => void; disabled?: boolean }) {
  const low = f && f.value !== null && f.confidence !== null && f.confidence < LOW_CONFIDENCE;
  const missing = f && f.value === null;
  return (
    <label className="block">
      <span className={cn("text-[0.6rem]", low ? "font-bold text-ember" : missing ? "text-gold" : "text-smoke")}>{label}{low ? " ⚠" : missing ? " (not read)" : ""}</span>
      <input value={value === 0 && missing ? "" : value} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value.replace(/[^\d.]/g, "")))} onBlur={onBlur} inputMode="decimal" className={cn("input py-1.5! text-sm", low && "border-ember/60!")} disabled={disabled} />
    </label>
  );
}

function Txt({ label, value, onChange, onBlur, type = "text", disabled }: { label: string; value: string; onChange: (v: string) => void; onBlur: () => void; type?: string; disabled?: boolean }) {
  return (
    <label className="block">
      <span className="text-[0.6rem] text-smoke">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} className="input py-1.5! text-sm" disabled={disabled} />
    </label>
  );
}
