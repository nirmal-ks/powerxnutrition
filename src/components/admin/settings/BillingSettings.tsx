"use client";

import Link from "next/link";
import { useState } from "react";
import { GST_RATES, type BusinessSettings } from "@/lib/settings-types";
import { Alert, api, Card, Field, Spinner } from "../ui";

export function BillingSettings({ initial, missingRates }: { initial: BusinessSettings; missingRates: number }) {
  const [b, setB] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = <K extends keyof BusinessSettings>(k: K, v: BusinessSettings[K]) => setB((x) => ({ ...x, [k]: v }));

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const d = await api<{ saved: BusinessSettings }>("/api/admin/settings", { method: "PUT", json: { group: "business", values: b } });
      setB(d.saved);
      setMsg({ ok: true, text: "Saved ✔ — recorded in the activity log. New bills use these details; old bills keep what was printed on them." });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card title="Business details (printed on every bill)">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Shop / trade name"><input value={b.tradeName} onChange={(e) => set("tradeName", e.target.value)} className="input" /></Field>
          <Field label="Legal name (as on GST certificate)"><input value={b.legalName} onChange={(e) => set("legalName", e.target.value)} className="input" placeholder="Required for GST invoices" /></Field>
          <Field label="Address" className="sm:col-span-2"><textarea value={b.address} onChange={(e) => set("address", e.target.value)} className="input" rows={2} /></Field>
          <Field label="State"><input value={b.state} onChange={(e) => set("state", e.target.value)} className="input" /></Field>
          <Field label="Phone on bill"><input value={b.phone} onChange={(e) => set("phone", e.target.value)} className="input" /></Field>
          <Field label="Email on bill"><input value={b.email} onChange={(e) => set("email", e.target.value)} className="input" /></Field>
          <Field label="Bill number prefix" hint={`Receipts: ${b.billPrefix || "PX"}R/26-27/00001 · GST invoices: ${b.billPrefix || "PX"}/26-27/00001 · restarts every April`}>
            <input value={b.billPrefix} onChange={(e) => set("billPrefix", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} className="input" />
          </Field>
          <Field label="Message at the bottom of receipts" className="sm:col-span-2"><input value={b.receiptFooter} onChange={(e) => set("receiptFooter", e.target.value)} className="input" /></Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={b.roundToRupee} onChange={(e) => set("roundToRupee", e.target.checked)} /> Round bill totals to the nearest rupee</label>
        </div>
      </Card>

      <Card title="GST">
        <label className="flex items-start gap-3 rounded-xl border border-white/10 p-3 text-sm">
          <input type="checkbox" className="mt-1" checked={b.gstRegistered} onChange={(e) => set("gstRegistered", e.target.checked)} />
          <span>
            <b>My business is GST-registered — issue GST tax invoices</b>
            <span className="block text-xs text-smoke">Leave OFF if you are not registered: bills are plain receipts with no GST lines (and say so).</span>
          </span>
        </label>
        {b.gstRegistered && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="GSTIN *" hint="Exactly as on your GST certificate. Never guessed.">
              <input value={b.gstin} onChange={(e) => set("gstin", e.target.value.toUpperCase().slice(0, 15))} className="input font-mono" placeholder="15 characters" />
            </Field>
            <Field label="GST state code *" hint="First 2 digits of your GSTIN (Tamil Nadu = 33)">
              <input value={b.stateCode} onChange={(e) => set("stateCode", e.target.value.replace(/\D/g, "").slice(0, 2))} className="input" />
            </Field>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={b.pricesIncludeTax} onChange={(e) => set("pricesIncludeTax", e.target.checked)} /> My selling prices already include GST (normal for retail; online prices are always treated as inclusive)
            </label>
            <Field label="GST on delivery charges">
              <select value={b.deliveryGstRate === null ? "" : String(b.deliveryGstRate)} onChange={(e) => set("deliveryGstRate", e.target.value === "" ? null : Number(e.target.value))} className="input">
                <option value="" className="bg-coal">Not taxed / not applicable</option>
                {GST_RATES.map((r) => <option key={r} value={r} className="bg-coal">{r}%</option>)}
              </select>
            </Field>
            <div className="text-xs text-smoke sm:col-span-2">
              Each product needs its HSN code and GST rate (Products → Edit). Bills can&apos;t be made for a product without a rate while GST is on.
              {missingRates > 0 && <Alert tone="warn" className="mt-2">{missingRates} published product(s) have no GST rate yet. <Link href="/admin/products" className="underline">Set them in Products</Link> before switching GST on.</Alert>}
              <p className="mt-2">Intra-state sales show CGST + SGST; online orders to other states show IGST. Please confirm rates and invoice format with your accountant.</p>
            </div>
          </div>
        )}
      </Card>
      {msg && <Alert tone={msg.ok ? "ok" : "error"}>{msg.text}</Alert>}
      <button onClick={save} disabled={busy} className="btn btn-red w-full">{busy && <Spinner />} Save billing settings</button>
    </div>
  );
}
