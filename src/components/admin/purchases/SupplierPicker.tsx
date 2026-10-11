"use client";

import { useState } from "react";
import { useCan } from "../SessionContext";
import { Alert, api, type ApiError, Spinner } from "../ui";

export interface SupplierOption {
  id: string;
  name: string;
  phone?: string;
}

/** Choose a supplier, or add one — with a "did you mean…?" check so duplicates aren't created by accident. */
export function SupplierPicker({ suppliers, value, onChange, onCreated }: { suppliers: SupplierOption[]; value: string; onChange: (id: string) => void; onCreated: (s: SupplierOption) => void }) {
  const can = useCan();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", gstin: "" });
  const [similar, setSimilar] = useState<SupplierOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const create = async (confirmNotDuplicate = false) => {
    setBusy(true);
    setErr("");
    try {
      const d = await api<{ supplier: SupplierOption }>("/api/admin/suppliers", { method: "POST", json: { ...form, confirmNotDuplicate } });
      onCreated(d.supplier);
      onChange(d.supplier.id);
      setAdding(false);
      setSimilar([]);
      setForm({ name: "", phone: "", gstin: "" });
    } catch (e) {
      const ae = e as ApiError;
      if (Array.isArray(ae.data?.similar)) setSimilar(ae.data.similar as SupplierOption[]);
      setErr(ae.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex gap-2">
        <select value={value} onChange={(e) => onChange(e.target.value)} className="input text-base">
          <option value="" className="bg-coal">— Select supplier —</option>
          {suppliers.map((s) => <option key={s.id} value={s.id} className="bg-coal">{s.name}</option>)}
        </select>
        {can("suppliers.manage") && (
          <button type="button" onClick={() => setAdding((v) => !v)} className="btn btn-ghost shrink-0 px-3! text-xs!">{adding ? "Cancel" : "+ New"}</button>
        )}
      </div>
      {adding && (
        <div className="mt-2 space-y-2 rounded-xl border border-white/10 p-3">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Supplier name *" className="input" autoFocus />
          <div className="grid grid-cols-2 gap-2">
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" inputMode="tel" className="input" />
            <input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} placeholder="GSTIN (optional)" className="input" maxLength={15} />
          </div>
          {err && <Alert tone={similar.length ? "warn" : "error"}>{err}</Alert>}
          {similar.length > 0 && (
            <div className="space-y-1">
              {similar.map((s) => (
                <button key={s.id} type="button" onClick={() => { onChange(s.id); setAdding(false); setSimilar([]); }} className="block w-full rounded-lg border border-gold/40 px-3 py-2 text-left text-sm hover:bg-gold/10">
                  Use <b>{s.name}</b> {s.phone ? `· ${s.phone}` : ""}
                </button>
              ))}
              <button type="button" onClick={() => create(true)} className="text-xs font-bold text-smoke underline">No, “{form.name}” is a different supplier — create it</button>
            </div>
          )}
          {!similar.length && (
            <button type="button" onClick={() => create(false)} disabled={busy || form.name.trim().length < 2} className="btn btn-gold w-full py-2.5!">
              {busy && <Spinner />} Save supplier
            </button>
          )}
        </div>
      )}
    </div>
  );
}
