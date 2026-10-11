"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/format";
import { inr2 } from "@/lib/money";
import type { PurchaseView } from "@/lib/server/purchases";
import { TrashIcon } from "../../ui/Icons";
import { useCan } from "../SessionContext";
import { Alert, api, type ApiError, Card, Field, labelCls, Spinner } from "../ui";
import { ProductLookup, type VariantHit } from "./ProductLookup";
import { SupplierPicker, type SupplierOption } from "./SupplierPicker";

interface Line {
  key: string;
  variantId: string | null;
  display: string;
  isNew: boolean;
  newProduct: { name: string; brand: string; category: string; label: string; flavour: string; sku: string; barcode: string; price: string; mrp: string };
  qty: string;
  unitCost: string;
  taxRate: string;
  batchNo: string;
  mfgDate: string;
  expiryDate: string;
  more: boolean;
}

const k = () => Math.random().toString(36).slice(2);
const emptyNew = { name: "", brand: "", category: "", label: "", flavour: "", sku: "", barcode: "", price: "", mrp: "" };

export function PurchaseForm({
  suppliers: initialSuppliers,
  categories,
  draft,
  quick,
}: {
  suppliers: SupplierOption[];
  categories: { slug: string; name: string }[];
  draft?: PurchaseView;
  quick?: boolean;
}) {
  const router = useRouter();
  const can = useCan();
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [supplierId, setSupplierId] = useState(draft?.supplier_id ?? "");
  const [invoiceNo, setInvoiceNo] = useState(draft?.supplier_invoice_no ?? "");
  const [invoiceDate, setInvoiceDate] = useState(draft?.invoice_date ?? "");
  const [notes, setNotes] = useState(draft?.notes ?? "");
  const [lines, setLines] = useState<Line[]>(
    draft?.items.map((i) => ({
      key: k(),
      variantId: i.variant_id,
      display: i.variant_id ? `${i.product_name} · ${[i.label, i.flavour].filter(Boolean).join(" · ")}` : i.new_product ? `NEW: ${i.new_product.brand} ${i.new_product.name} · ${i.new_product.label}` : i.description,
      isNew: !i.variant_id && Boolean(i.new_product),
      newProduct: i.new_product ? { ...emptyNew, ...Object.fromEntries(Object.entries(i.new_product).map(([a, b]) => [a, b === null || b === undefined ? "" : String(b)])) } : emptyNew,
      qty: String(i.qty),
      unitCost: String(i.unit_cost),
      taxRate: i.tax_rate === null ? "" : String(i.tax_rate),
      batchNo: i.batch_no,
      mfgDate: i.mfg_date ?? "",
      expiryDate: i.expiry_date ?? "",
      more: Boolean(i.batch_no || i.expiry_date),
    })) ?? [],
  );
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState<"" | "draft" | "confirm">("");
  const [err, setErr] = useState("");
  const [dup, setDup] = useState<{ of: string } | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [savedDraftId, setSavedDraftId] = useState(draft?.id ?? "");

  const set = (key: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const addVariant = (v: VariantHit) => {
    const existing = lines.find((l) => l.variantId === v.variant_id && !l.batchNo);
    if (existing) {
      set(existing.key, { qty: String((Number(existing.qty) || 0) + 1) });
      return;
    }
    setLines((ls) => [
      ...ls,
      { key: k(), variantId: v.variant_id, display: `${v.name} · ${[v.label, v.flavour].filter(Boolean).join(" · ")}`, isNew: false, newProduct: emptyNew, qty: "1", unitCost: v.avg_cost ? String(v.avg_cost) : "", taxRate: "", batchNo: "", mfgDate: "", expiryDate: "", more: false },
    ]);
  };
  const addNew = () => setLines((ls) => [...ls, { key: k(), variantId: null, display: "", isNew: true, newProduct: { ...emptyNew }, qty: "1", unitCost: "", taxRate: "", batchNo: "", mfgDate: "", expiryDate: "", more: true }]);

  const lineTotal = (l: Line) => (Number(l.qty) || 0) * (Number(l.unitCost) || 0) * (1 + (Number(l.taxRate) || 0) / 100);
  const total = lines.reduce((s, l) => s + lineTotal(l), 0);
  const units = lines.reduce((s, l) => s + (Number(l.qty) || 0), 0);

  const problems: string[] = [];
  if (!supplierId) problems.push("Select the supplier");
  if (!lines.length) problems.push("Add at least one product");
  lines.forEach((l, i) => {
    const n = i + 1;
    if (!Number.isInteger(Number(l.qty)) || Number(l.qty) <= 0) problems.push(`Line ${n}: quantity must be a whole number`);
    if (l.unitCost === "" || !(Number(l.unitCost) >= 0)) problems.push(`Line ${n}: enter the cost per unit`);
    if (l.isNew && (!l.newProduct.name || !l.newProduct.brand || !l.newProduct.category || !l.newProduct.label || !(Number(l.newProduct.price) > 0))) problems.push(`Line ${n}: new product needs name, brand, category, size & selling price`);
    if (l.expiryDate && l.mfgDate && l.expiryDate < l.mfgDate) problems.push(`Line ${n}: expiry before mfg date`);
  });

  const body = () => ({
    supplierId,
    supplierInvoiceNo: invoiceNo,
    invoiceDate: invoiceDate || null,
    notes,
    lines: lines.map((l) => ({
      variantId: l.isNew ? null : l.variantId,
      newProduct: l.isNew ? { ...l.newProduct, price: Number(l.newProduct.price), mrp: Number(l.newProduct.mrp) || Number(l.newProduct.price) } : null,
      qty: Number(l.qty),
      unitCost: Number(l.unitCost),
      taxRate: l.taxRate === "" ? null : Number(l.taxRate),
      batchNo: l.batchNo,
      mfgDate: l.mfgDate || null,
      expiryDate: l.expiryDate || null,
    })),
  });

  const saveDraft = async () => {
    setBusy("draft");
    setErr("");
    try {
      const d = savedDraftId
        ? await api<{ purchase: PurchaseView }>(`/api/admin/purchases/${savedDraftId}`, { method: "PUT", json: body() })
        : await api<{ purchase: PurchaseView }>("/api/admin/purchases", { method: "POST", json: body() });
      setSavedDraftId(d.purchase.id);
      router.push(`/admin/purchases/${d.purchase.id}?saved=draft`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const confirm = async () => {
    setBusy("confirm");
    setErr("");
    try {
      let id = savedDraftId;
      if (id) await api(`/api/admin/purchases/${id}`, { method: "PUT", json: body() });
      else {
        const d = await api<{ purchase: PurchaseView }>("/api/admin/purchases", { method: "POST", json: body() });
        id = d.purchase.id;
        setSavedDraftId(id);
      }
      await api(`/api/admin/purchases/${id}`, { method: "POST", json: { action: "confirm", overrideDuplicateReason: dup ? overrideReason : undefined } });
      router.push(`/admin/purchases/${id}?saved=confirmed`);
      router.refresh();
    } catch (e) {
      const ae = e as ApiError;
      if (ae.data?.code === "DUPLICATE_INVOICE") setDup({ of: String(ae.data.duplicateOf) });
      setErr(ae.message);
    } finally {
      setBusy("");
    }
  };

  const supplierName = suppliers.find((s) => s.id === supplierId)?.name;

  if (preview) {
    return (
      <div className="space-y-4">
        <Card title="Check before confirming">
          <p className="text-sm text-zinc-300">
            Supplier <b>{supplierName}</b>{invoiceNo ? <> · invoice <b>{invoiceNo}</b></> : null}{invoiceDate ? ` · ${invoiceDate}` : ""}
          </p>
          <ul className="mt-3 divide-y divide-white/5 text-sm">
            {lines.map((l) => (
              <li key={l.key} className="flex justify-between gap-2 py-2">
                <span>
                  {l.isNew ? <b className="text-gold">NEW · </b> : null}
                  {l.isNew ? `${l.newProduct.brand} ${l.newProduct.name} · ${l.newProduct.label}${l.newProduct.flavour ? ` · ${l.newProduct.flavour}` : ""}` : l.display}
                  <span className="block text-xs text-smoke">
                    {l.qty} × {inr2(Number(l.unitCost))}{l.taxRate ? ` + ${l.taxRate}% GST` : ""}{l.batchNo ? ` · batch ${l.batchNo}` : ""}{l.expiryDate ? ` · exp ${l.expiryDate}` : ""}
                  </span>
                </span>
                <b>{inr2(lineTotal(l))}</b>
              </li>
            ))}
          </ul>
          <p className="mt-2 flex justify-between border-t border-white/10 pt-2 text-lg font-extrabold">
            <span>{units} unit(s)</span>
            <span className="text-gold">{inr2(total)}</span>
          </p>
          {lines.some((l) => l.isNew) && <Alert tone="info" className="mt-3">New products are created as <b>unpublished drafts</b> with photo pending — check them in Products and Product photos before they appear online.</Alert>}
        </Card>
        {err && <Alert>{err}</Alert>}
        {dup && (
          <Card title="Same invoice already received">
            <p className="mb-2 text-sm text-zinc-300">Invoice {invoiceNo} from this supplier was already received in <b>{dup.of}</b>. Receiving it again would double the stock.</p>
            {can("purchases.override_duplicate") ? (
              <>
                <input value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="Reason to receive again (e.g. second delivery on same invoice no.)" className="input mb-2" />
                <p className="text-xs text-smoke">This override is recorded in the activity log.</p>
              </>
            ) : (
              <p className="text-sm text-gold">Only the owner can override this. Check the invoice number.</p>
            )}
          </Card>
        )}
        <div className="flex gap-2">
          <button onClick={() => setPreview(false)} className="btn btn-ghost flex-1">← Edit</button>
          <button onClick={confirm} disabled={!!busy || (dup !== null && overrideReason.trim().length < 5)} className="btn btn-red flex-[2] py-4!">
            {busy === "confirm" && <Spinner />} Confirm receipt · add {units} to stock
          </button>
        </div>
        <p className="text-center text-xs text-smoke">Confirming adds the stock immediately (once — pressing twice is safe).</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <span className={labelCls}>Supplier *</span>
            <SupplierPicker suppliers={suppliers} value={supplierId} onChange={setSupplierId} onCreated={(s) => setSuppliers((x) => [...x, s].sort((a, b) => a.name.localeCompare(b.name)))} />
          </div>
          <Field label="Supplier invoice no." hint="Used to stop the same invoice being received twice">
            <input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} className="input" placeholder="e.g. INV-1042" />
          </Field>
          <Field label="Invoice date">
            <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="input" />
          </Field>
          {!quick && (
            <Field label="Notes">
              <input value={notes} onChange={(e) => setNotes(e.target.value)} className="input" placeholder="Optional" />
            </Field>
          )}
        </div>
      </Card>

      <Card title="Products received">
        <ProductLookup onPick={addVariant} autoFocus={quick} />
        <button type="button" onClick={addNew} className="mt-2 text-xs font-bold text-gold underline">+ New product (not in the shop yet)</button>
        <ul className="mt-3 space-y-3">
          {lines.map((l, i) => (
            <li key={l.key} className="rounded-2xl border border-white/10 p-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <p className="text-sm font-semibold">{i + 1}. {l.isNew ? <span className="text-gold">New product</span> : l.display}</p>
                <button type="button" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} className="p-1 text-smoke hover:text-ember" aria-label="Remove line"><TrashIcon size={16} /></button>
              </div>
              {l.isNew && (
                <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <input value={l.newProduct.brand} onChange={(e) => set(l.key, { newProduct: { ...l.newProduct, brand: e.target.value } })} placeholder="Brand *" className="input py-2!" />
                  <input value={l.newProduct.name} onChange={(e) => set(l.key, { newProduct: { ...l.newProduct, name: e.target.value } })} placeholder="Product name *" className="input py-2! sm:col-span-2" />
                  <select value={l.newProduct.category} onChange={(e) => set(l.key, { newProduct: { ...l.newProduct, category: e.target.value } })} className="input py-2!">
                    <option value="" className="bg-coal">Category *</option>
                    {categories.map((c) => <option key={c.slug} value={c.slug} className="bg-coal">{c.name}</option>)}
                  </select>
                  <input value={l.newProduct.label} onChange={(e) => set(l.key, { newProduct: { ...l.newProduct, label: e.target.value } })} placeholder="Size * (e.g. 1 kg)" className="input py-2!" />
                  <input value={l.newProduct.flavour} onChange={(e) => set(l.key, { newProduct: { ...l.newProduct, flavour: e.target.value } })} placeholder="Flavour" className="input py-2!" />
                  <input value={l.newProduct.sku} onChange={(e) => set(l.key, { newProduct: { ...l.newProduct, sku: e.target.value } })} placeholder="SKU" className="input py-2!" />
                  <input value={l.newProduct.barcode} onChange={(e) => set(l.key, { newProduct: { ...l.newProduct, barcode: e.target.value } })} placeholder="Barcode" inputMode="numeric" className="input py-2!" />
                  <input value={l.newProduct.price} onChange={(e) => set(l.key, { newProduct: { ...l.newProduct, price: e.target.value } })} placeholder="Selling price ₹ *" inputMode="decimal" className="input py-2!" />
                  <input value={l.newProduct.mrp} onChange={(e) => set(l.key, { newProduct: { ...l.newProduct, mrp: e.target.value } })} placeholder="MRP ₹" inputMode="decimal" className="input py-2!" />
                </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                <label className="block">
                  <span className="text-[0.65rem] text-smoke">Qty *</span>
                  <input value={l.qty} onChange={(e) => set(l.key, { qty: e.target.value.replace(/\D/g, "") })} inputMode="numeric" className="input py-2! text-lg font-bold" />
                </label>
                <label className="block">
                  <span className="text-[0.65rem] text-smoke">Cost / unit ₹ *</span>
                  <input value={l.unitCost} onChange={(e) => set(l.key, { unitCost: e.target.value.replace(/[^\d.]/g, "") })} inputMode="decimal" className="input py-2! text-lg" />
                </label>
                <label className="block">
                  <span className="text-[0.65rem] text-smoke">GST %</span>
                  <input value={l.taxRate} onChange={(e) => set(l.key, { taxRate: e.target.value.replace(/[^\d.]/g, "") })} inputMode="decimal" placeholder="—" className="input py-2! text-lg" />
                </label>
              </div>
              {l.more ? (
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <label className="block"><span className="text-[0.65rem] text-smoke">Batch no.</span><input value={l.batchNo} onChange={(e) => set(l.key, { batchNo: e.target.value })} className="input py-2!" /></label>
                  <label className="block"><span className="text-[0.65rem] text-smoke">Mfg date</span><input type="date" value={l.mfgDate} onChange={(e) => set(l.key, { mfgDate: e.target.value })} className="input py-2!" /></label>
                  <label className="block"><span className="text-[0.65rem] text-smoke">Expiry date</span><input type="date" value={l.expiryDate} onChange={(e) => set(l.key, { expiryDate: e.target.value })} className="input py-2!" /></label>
                </div>
              ) : (
                <button type="button" onClick={() => set(l.key, { more: true })} className="mt-2 text-xs font-bold text-smoke underline">+ Batch / expiry</button>
              )}
              <p className="mt-2 text-right text-sm">Line total <b className="text-gold">{inr2(lineTotal(l))}</b></p>
            </li>
          ))}
        </ul>
        {!lines.length && <p className="mt-3 text-center text-sm text-smoke">Search above (or scan the barcode) to add each product in the delivery.</p>}
      </Card>

      <div className="sticky bottom-0 z-10 -mx-3 space-y-2 border-t border-white/10 bg-[#0b0b0d]/95 px-3 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <p className="flex justify-between text-sm">
          <span>{lines.length} line(s) · {units} unit(s)</span>
          <b className="text-gold">{inr2(total)}</b>
        </p>
        {err && <Alert>{err}</Alert>}
        {problems.length > 0 && lines.length > 0 && <p className="text-xs text-gold">{problems[0]}{problems.length > 1 ? ` (+${problems.length - 1} more)` : ""}</p>}
        <div className="flex gap-2">
          <button onClick={saveDraft} disabled={!!busy || !supplierId || !lines.length} className="btn btn-ghost flex-1">
            {busy === "draft" && <Spinner />} Save draft
          </button>
          <button onClick={() => setPreview(true)} disabled={problems.length > 0 || !can("purchases.confirm")} className={cn("btn btn-red flex-[2]")}>
            Preview & confirm →
          </button>
        </div>
        <p className="text-center text-[0.7rem] text-smoke">Drafts don&apos;t change stock. <Link href="/admin/purchases" className="underline">All purchases</Link></p>
      </div>
    </div>
  );
}
