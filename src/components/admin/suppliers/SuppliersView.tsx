"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/format";
import { inr2 } from "@/lib/money";
import type { Supplier } from "@/lib/server/suppliers";
import { PhoneIcon, SearchIcon, WhatsAppIcon } from "../../ui/Icons";
import { SupplierPicker } from "../purchases/SupplierPicker";
import { Alert, api, Badge, Card, Empty, fmtDate, fmtDay, Spinner, useApi } from "../ui";

type Row = Supplier & { purchases: number; purchase_total: number; outstanding: number; last_purchase: string | null };
type Detail = {
  supplier: Supplier;
  purchases: { id: string; purchase_no: string; supplier_invoice_no: string; status: string; total: number; paid_amount: number; units: number; created_at: string; confirmed_at: string | null }[];
  products: { variant_id: string; name: string; label: string; flavour: string; qty: number; last_cost: number; last_date: string }[];
  invoices: { id: string; file_name: string; invoice_no: string; status: string; created_at: string }[];
};

export function SuppliersView() {
  const [q, setQ] = useState("");
  const list = useApi<{ suppliers: Row[] }>(`/api/admin/suppliers${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
      <div>
        <div className="mb-3 flex gap-2">
          <label className="relative flex-1">
            <SearchIcon size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-smoke" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, phone, GSTIN" className="input pl-10" />
          </label>
          <button onClick={() => setAdding((v) => !v)} className="btn btn-red px-3! text-xs!">+ Add</button>
        </div>
        {adding && (
          <div className="mb-3">
            <SupplierPicker suppliers={[]} value="" onChange={(id) => { setOpen(id); setAdding(false); }} onCreated={() => list.reload()} />
          </div>
        )}
        {list.data && !list.data.suppliers.length && <Empty>No suppliers yet.</Empty>}
        <ul className="space-y-1.5">
          {list.data?.suppliers.map((s) => (
            <li key={s.id}>
              <button onClick={() => setOpen(s.id)} className={cn("w-full rounded-xl border p-3 text-left", open === s.id ? "border-gold bg-gold/5" : "border-white/8 bg-coal hover:border-white/20", !s.active && "opacity-50")}>
                <p className="font-semibold">{s.name}</p>
                <p className="text-xs text-smoke">{s.purchases} purchase(s) · {inr2(s.purchase_total)}{s.last_purchase ? ` · last ${fmtDay(s.last_purchase)}` : ""}</p>
                {s.outstanding > 0 && <p className="text-xs font-bold text-ember">Due {inr2(s.outstanding)}</p>}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div>{open ? <SupplierDetail id={open} onSaved={list.reload} /> : <Empty>Choose a supplier.</Empty>}</div>
    </div>
  );
}

function SupplierDetail({ id, onSaved }: { id: string; onSaved: () => void }) {
  const { data, reload, error } = useApi<Detail>(`/api/admin/suppliers/${id}`);
  const [edit, setEdit] = useState<Partial<Supplier> | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (error) return <Alert>{error}</Alert>;
  if (!data) return <p className="p-6 text-center"><Spinner /></p>;
  const s = data.supplier;
  const due = data.purchases.filter((p) => p.status === "confirmed").reduce((x, p) => x + p.total - p.paid_amount, 0);

  const save = async () => {
    setBusy(true);
    setErr("");
    try {
      await api(`/api/admin/suppliers/${id}`, { method: "PATCH", json: edit });
      setEdit(null);
      reload();
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        {edit ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {(["name", "phone", "email", "gstin"] as const).map((k) => (
              <input key={k} value={String(edit[k] ?? "")} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} placeholder={k} className="input" />
            ))}
            <textarea value={edit.address ?? ""} onChange={(e) => setEdit({ ...edit, address: e.target.value })} placeholder="Address" className="input sm:col-span-2" rows={2} />
            <textarea value={edit.notes ?? ""} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} placeholder="Notes (payment terms, contact person…)" className="input sm:col-span-2" rows={2} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.active ?? true} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> Active</label>
            {err && <Alert className="sm:col-span-2">{err}</Alert>}
            <div className="flex gap-2 sm:col-span-2">
              <button onClick={() => setEdit(null)} className="btn btn-ghost flex-1">Cancel</button>
              <button onClick={save} disabled={busy} className="btn btn-red flex-1">{busy && <Spinner />} Save</button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl">{s.name} {!s.active && <Badge>inactive</Badge>}</h2>
              <p className="text-sm text-zinc-300">{[s.phone, s.email, s.gstin && `GSTIN ${s.gstin}`].filter(Boolean).join(" · ") || "No contact details"}</p>
              {s.address && <p className="text-sm text-smoke">{s.address}</p>}
              {s.notes && <p className="mt-1 text-sm text-smoke">📝 {s.notes}</p>}
              {due > 0 && <p className="mt-2 font-bold text-ember">Outstanding to pay: {inr2(due)}</p>}
            </div>
            <div className="flex gap-2">
              {s.phone && <a href={`tel:${s.phone}`} className="btn btn-ghost px-3! py-2!"><PhoneIcon size={16} /></a>}
              {s.phone && <a href={`https://wa.me/91${s.phone.replace(/\D/g, "").slice(-10)}`} target="_blank" rel="noopener" className="btn btn-whatsapp px-3! py-2!"><WhatsAppIcon size={16} /></a>}
              <button onClick={() => setEdit(s)} className="btn btn-ghost px-3! py-2! text-xs!">Edit</button>
            </div>
          </div>
        )}
      </Card>
      <Card title="Purchases" action={<Link href="/admin/inventory/stock-in" className="text-xs font-bold text-gold">+ Receive stock</Link>}>
        {!data.purchases.length ? <Empty>No purchases yet.</Empty> : (
          <ul className="divide-y divide-white/5 text-sm">
            {data.purchases.map((p) => (
              <li key={p.id}>
                <Link href={`/admin/purchases/${p.id}`} className="flex justify-between gap-2 py-2 hover:text-gold">
                  <span>{p.purchase_no}{p.supplier_invoice_no ? ` · inv ${p.supplier_invoice_no}` : ""} <span className="text-xs text-smoke">· {p.units} units · {fmtDate(p.confirmed_at ?? p.created_at)}</span></span>
                  <span>{p.status === "confirmed" ? inr2(p.total) : <Badge tone="gold">{p.status}</Badge>}{p.status === "confirmed" && p.paid_amount < p.total && <span className="ml-1 text-xs text-ember">due {inr2(p.total - p.paid_amount)}</span>}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Products supplied">
          {!data.products.length ? <Empty>Nothing received yet.</Empty> : (
            <ul className="space-y-1 text-sm">
              {data.products.map((p) => (
                <li key={p.variant_id} className="flex justify-between gap-2">
                  <span className="truncate">{p.name} <span className="text-smoke">({[p.label, p.flavour].filter(Boolean).join(", ")})</span></span>
                  <span className="shrink-0 text-xs">{p.qty} · last {inr2(p.last_cost)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Invoices">
          {!data.invoices.length ? <Empty>No scanned invoices.</Empty> : (
            <ul className="space-y-1 text-sm">
              {data.invoices.map((i) => (
                <li key={i.id}><Link href={`/admin/purchases/import-invoice/${i.id}`} className="hover:text-gold">{i.invoice_no || i.file_name} <span className="text-xs text-smoke">· {i.status} · {fmtDay(i.created_at)}</span></Link></li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
