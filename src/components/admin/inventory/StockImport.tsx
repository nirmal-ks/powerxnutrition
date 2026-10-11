"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/format";
import type { ImportRow } from "@/lib/server/stock-import";
import { useCan } from "../SessionContext";
import { Alert, api, type ApiError, Badge, Card, Empty, fmtDate, Spinner, useApi } from "../ui";

type Summary = { imported: number; rejected: number; units: number; newProducts: number; purchases: { purchaseNo: string; id: string; lines: number; units: number }[] };

export function StockImport({ suppliers, categories }: { suppliers: { id: string; name: string }[]; categories: { slug: string; name: string }[] }) {
  const can = useCan();
  const [supplierId, setSupplierId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [importId, setImportId] = useState("");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [dup, setDup] = useState("");
  const [reason, setReason] = useState("");
  const [filter, setFilter] = useState<"all" | "errors" | "new" | "ok">("all");
  const history = useApi<{ imports: { id: string; file_name: string; status: string; rows: number; errors: number; created_at: string; created_by_name: string | null }[] }>("/api/admin/imports");

  const upload = async () => {
    if (!file) return;
    setBusy("upload");
    setErr("");
    setSummary(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (supplierId) fd.append("supplierId", supplierId);
      const d = await api<{ id: string; rows: ImportRow[] }>("/api/admin/imports", { method: "POST", body: fd });
      setImportId(d.id);
      setRows(d.rows);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const patch = async (changes: Partial<ImportRow>[], sid?: string | null) => {
    setBusy("save");
    setErr("");
    try {
      const d = await api<{ rows: ImportRow[] }>(`/api/admin/imports/${importId}`, { method: "PATCH", json: { rows: changes, ...(sid !== undefined ? { supplierId: sid } : {}) } });
      setRows(d.rows);
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
      const d = await api<{ summary: Summary }>(`/api/admin/imports/${importId}`, { method: "POST", json: { action: "confirm", overrideDuplicateReason: dup ? reason : undefined } });
      setSummary(d.summary);
      setRows([]);
      history.reload();
    } catch (e) {
      const ae = e as ApiError;
      if (ae.data?.code === "DUPLICATE_INVOICE") setDup(String(ae.data.duplicateOf));
      setErr(ae.message);
    } finally {
      setBusy("");
    }
  };

  const discard = async () => {
    if (!window.confirm("Discard this import? Nothing was added to stock.")) return;
    await api(`/api/admin/imports/${importId}`, { method: "POST", json: { action: "discard" } }).catch(() => undefined);
    setRows([]);
    setImportId("");
    history.reload();
  };

  const active = rows.filter((r) => r.action !== "reject");
  const errors = active.filter((r) => r.errors.length).length;
  const shown = rows.filter((r) => (filter === "errors" ? r.errors.length && r.action !== "reject" : filter === "new" ? r.action === "new" : filter === "ok" ? !r.errors.length && r.action !== "reject" : true));

  if (summary) {
    return (
      <Card title="Import complete ✔">
        <p className="text-sm text-zinc-300">
          {summary.imported} row(s) imported · <b>{summary.units} unit(s) added to stock</b> · {summary.rejected} rejected · {summary.newProducts} new product(s) created as unpublished drafts.
        </p>
        <ul className="mt-3 space-y-1 text-sm">
          {summary.purchases.map((p) => (
            <li key={p.id}><Link href={`/admin/purchases/${p.id}`} className="text-gold underline">{p.purchaseNo}</Link> — {p.lines} line(s), {p.units} unit(s)</li>
          ))}
        </ul>
        {summary.newProducts > 0 && <p className="mt-3 text-sm"><Link href="/admin/images" className="text-gold underline">Add photos for the new products →</Link></p>}
        <button onClick={() => { setSummary(null); setFile(null); setImportId(""); }} className="btn btn-ghost mt-4">Import another file</button>
      </Card>
    );
  }

  if (!rows.length) {
    return (
      <div className="space-y-4">
        <Card title="1 · Get the template">
          <p className="mb-3 text-sm text-smoke">Fill one row per product received. SKU or barcode is the best way to match existing products. Dates: YYYY-MM-DD or DD/MM/YYYY.</p>
          <div className="flex flex-wrap gap-2">
            <a href="/api/admin/imports/template?format=xlsx" className="btn btn-gold">⬇ Excel template</a>
            <a href="/api/admin/imports/template?format=csv" className="btn btn-ghost">⬇ CSV template</a>
          </div>
        </Card>
        <Card title="2 · Upload the file">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-400">Supplier (for rows without one)</span>
              <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="input">
                <option value="" className="bg-coal">— Use the Supplier column —</option>
                {suppliers.map((s) => <option key={s.id} value={s.id} className="bg-coal">{s.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-400">File (.xlsx or .csv)</span>
              <input type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="input py-2!" />
            </label>
          </div>
          {err && <Alert className="mt-3">{err}</Alert>}
          <button onClick={upload} disabled={!file || !!busy} className="btn btn-red mt-3 w-full sm:w-auto">{busy && <Spinner />} Upload & preview</button>
        </Card>
        <Card title="Import history">
          {!history.data?.imports.length ? (
            <Empty>No imports yet.</Empty>
          ) : (
            <ul className="divide-y divide-white/5 text-sm">
              {history.data.imports.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    {i.file_name} <Badge tone={i.status === "confirmed" ? "green" : i.status === "preview" ? "gold" : "zinc"}>{i.status}</Badge>
                    <span className="block text-xs text-smoke">{fmtDate(i.created_at)} · {i.rows} row(s) · {i.created_by_name ?? ""}</span>
                  </span>
                  <span className="flex gap-3 text-xs">
                    {i.status === "preview" && (
                      <button
                        onClick={async () => {
                          const d = await api<{ import: { rows: ImportRow[]; supplier_id: string | null } }>(`/api/admin/imports/${i.id}`);
                          setImportId(i.id);
                          setRows(d.import.rows);
                          setSupplierId(d.import.supplier_id ?? "");
                        }}
                        className="font-bold text-gold underline"
                      >
                        Continue
                      </button>
                    )}
                    <a href={`/api/admin/imports/${i.id}?format=errors`} className="text-smoke underline">Error report</a>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span><b>{rows.length}</b> rows</span>
          <Badge tone="green">{active.length - errors} ready</Badge>
          {errors > 0 && <Badge tone="red">{errors} need fixing</Badge>}
          <Badge tone="gold">{rows.filter((r) => r.action === "new").length} new products</Badge>
          <Badge>{rows.length - active.length} rejected</Badge>
          <a href={`/api/admin/imports/${importId}?format=errors`} className="ml-auto text-xs font-bold text-gold underline">⬇ Error report</a>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-smoke">Supplier for rows without one:</span>
          <select value={supplierId} onChange={(e) => { setSupplierId(e.target.value); patch([], e.target.value || null); }} className="input w-auto! py-1.5! text-xs">
            <option value="" className="bg-coal">— none —</option>
            {suppliers.map((s) => <option key={s.id} value={s.id} className="bg-coal">{s.name}</option>)}
          </select>
          <div className="ml-auto flex gap-1">
            {(["all", "errors", "new", "ok"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={cn("rounded-full border px-3 py-1 text-xs font-bold", filter === f ? "border-transparent bg-blood text-white" : "border-white/10 text-zinc-400")}>{f}</button>
            ))}
          </div>
        </div>
      </Card>

      <ul className="space-y-2">
        {shown.map((r) => (
          <li key={r.line} className={cn("rounded-2xl border bg-coal p-3 text-sm", r.action === "reject" ? "border-white/5 opacity-50" : r.errors.length ? "border-ember/50" : r.action === "new" ? "border-gold/40" : "border-white/8")}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold">
                  <span className="text-smoke">#{r.line}</span> {r.brand} {r.name} {r.size && <span className="text-smoke">· {r.size}</span>} {r.flavour && <span className="text-smoke">· {r.flavour}</span>}
                </p>
                <p className="text-xs text-smoke">
                  {r.sku && `SKU ${r.sku} · `}{r.barcode && `${r.barcode} · `}qty <b className="text-white">{r.qty || "?"}</b> × ₹{r.cost || "?"}
                  {r.batchNo && ` · batch ${r.batchNo}`}{r.expiryDate && ` · exp ${r.expiryDate}`}{r.supplier && ` · ${r.supplier}`}{r.invoiceNo && ` · inv ${r.invoiceNo}`}
                </p>
              </div>
              <div className="flex gap-1">
                {(["existing", "new", "reject"] as const).map((a) => (
                  <button key={a} disabled={busy === "save"} onClick={() => patch([{ line: r.line, action: a }])} className={cn("rounded-lg border px-2 py-1 text-[0.7rem] font-bold", r.action === a ? (a === "reject" ? "border-ember text-ember" : "border-gold text-gold") : "border-white/10 text-zinc-500")}>
                    {a === "existing" ? "Existing" : a === "new" ? "New" : "Reject"}
                  </button>
                ))}
              </div>
            </div>
            {r.action === "existing" && (
              <div className="mt-2">
                {r.variantId && r.matchLabel ? (
                  <p className="text-xs text-green-300">✔ Matched by {r.matchedBy}: {r.matchLabel}</p>
                ) : null}
                {r.candidates.length > 0 && (!r.variantId || r.matchedBy !== "sku") && (
                  <select value={r.variantId ?? ""} onChange={(e) => patch([{ line: r.line, variantId: e.target.value || null }])} className="input mt-1 py-2! text-xs">
                    <option value="" className="bg-coal">— Choose the exact product (check size & flavour) —</option>
                    {r.candidates.map((c) => (
                      <option key={c.variantId} value={c.variantId} className="bg-coal">{c.label} — {c.score}%{c.reasons.length ? ` (${c.reasons.join(", ")})` : ""}</option>
                    ))}
                  </select>
                )}
              </div>
            )}
            {r.action === "new" && (
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <EditCell label="Brand" value={r.brand} onSave={(v) => patch([{ line: r.line, brand: v }])} />
                <EditCell label="Name" value={r.name} onSave={(v) => patch([{ line: r.line, name: v }])} />
                <label className="block">
                  <span className="text-[0.6rem] text-smoke">Category</span>
                  <select value={r.category} onChange={(e) => patch([{ line: r.line, category: e.target.value }])} className="input py-1.5! text-xs">
                    <option value="" className="bg-coal">—</option>
                    {categories.map((c) => <option key={c.slug} value={c.slug} className="bg-coal">{c.name}</option>)}
                  </select>
                </label>
                <EditCell label="Size" value={r.size} onSave={(v) => patch([{ line: r.line, size: v }])} />
                <EditCell label="Selling price" value={r.price} onSave={(v) => patch([{ line: r.line, price: v }])} />
              </div>
            )}
            {r.action !== "reject" && (
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
                <EditCell label="Qty" value={r.qty} onSave={(v) => patch([{ line: r.line, qty: v }])} />
                <EditCell label="Cost" value={r.cost} onSave={(v) => patch([{ line: r.line, cost: v }])} />
                <EditCell label="GST %" value={r.gst} onSave={(v) => patch([{ line: r.line, gst: v }])} />
                <EditCell label="Batch" value={r.batchNo} onSave={(v) => patch([{ line: r.line, batchNo: v }])} />
                <EditCell label="Expiry" value={r.expiryDate} onSave={(v) => patch([{ line: r.line, expiryDate: v }])} />
                <label className="block">
                  <span className="text-[0.6rem] text-smoke">Supplier</span>
                  <select value={r.supplierId ?? ""} onChange={(e) => patch([{ line: r.line, supplierId: e.target.value || null }])} className="input py-1.5! text-xs">
                    <option value="" className="bg-coal">{r.supplier || "—"}</option>
                    {suppliers.map((s) => <option key={s.id} value={s.id} className="bg-coal">{s.name}</option>)}
                  </select>
                </label>
              </div>
            )}
            {r.action !== "reject" && r.errors.map((e) => <p key={e} className="mt-1 text-xs text-ember">✖ {e}</p>)}
            {r.action !== "reject" && r.warnings.map((w) => <p key={w} className="mt-1 text-xs text-gold">⚠ {w}</p>)}
          </li>
        ))}
      </ul>

      <div className="sticky bottom-0 z-10 -mx-3 space-y-2 border-t border-white/10 bg-[#0b0b0d]/95 px-3 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
        {err && <Alert>{err}</Alert>}
        {dup && can("purchases.override_duplicate") && <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={`Reason to import invoice again (already in ${dup})`} className="input" />}
        <div className="flex gap-2">
          <button onClick={discard} className="btn btn-ghost flex-1">Discard</button>
          <button onClick={confirm} disabled={!!busy || errors > 0 || !active.length || !can("purchases.confirm") || (Boolean(dup) && reason.trim().length < 5)} className="btn btn-red flex-[2]">
            {busy === "confirm" && <Spinner />} {errors ? `Fix ${errors} row(s) first` : `Confirm import · ${active.length} row(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditCell({ label, value, onSave }: { label: string; value: string; onSave: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-[0.6rem] text-smoke">{label}</span>
      <input defaultValue={value} key={value} onBlur={(e) => e.target.value !== value && onSave(e.target.value)} className="input py-1.5! text-xs" />
    </label>
  );
}
