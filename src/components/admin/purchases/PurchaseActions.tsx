"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCan } from "../SessionContext";
import { Alert, api, type ApiError, Spinner } from "../ui";

export function PurchaseActions({ id, status, due, invoiceImportId }: { id: string; status: string; due: number; invoiceImportId: string | null }) {
  const router = useRouter();
  const can = useCan();
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [dupOf, setDupOf] = useState("");
  const [reason, setReason] = useState("");
  const [pay, setPay] = useState("");

  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(action);
    setErr("");
    try {
      await api(`/api/admin/purchases/${id}`, { method: "POST", json: { action, ...extra } });
      router.replace(`/admin/purchases/${id}${action === "confirm" ? "?saved=confirmed" : ""}`);
      router.refresh();
    } catch (e) {
      const ae = e as ApiError;
      if (ae.data?.code === "DUPLICATE_INVOICE") setDupOf(String(ae.data.duplicateOf));
      setErr(ae.message);
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="space-y-3">
      {err && <Alert>{err}</Alert>}
      {status === "draft" && (
        <>
          {dupOf && can("purchases.override_duplicate") && (
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason to receive this invoice again (owner)" className="input" />
          )}
          <div className="flex flex-wrap gap-2">
            <Link href={`/admin/purchases/${id}?edit=1`} className="btn btn-ghost flex-1">Edit draft</Link>
            <button onClick={() => window.confirm("Cancel this draft? No stock was added, nothing else changes.") && act("cancel")} disabled={!!busy} className="btn btn-ghost flex-1 text-ember!">Cancel draft</button>
            {can("purchases.confirm") && (
              <button onClick={() => act("confirm", dupOf ? { overrideDuplicateReason: reason } : {})} disabled={!!busy || (Boolean(dupOf) && reason.trim().length < 5)} className="btn btn-red w-full py-4!">
                {busy === "confirm" && <Spinner />} Confirm receipt — add to stock
              </button>
            )}
          </div>
        </>
      )}
      {status === "confirmed" && due > 0 && can("expenses.manage") && (
        <div className="flex gap-2">
          <input value={pay} onChange={(e) => setPay(e.target.value.replace(/[^\d.]/g, ""))} placeholder={`Paid to supplier (due ₹${due})`} inputMode="decimal" className="input" />
          <button onClick={() => act("payment", { amount: Number(pay) }).then(() => setPay(""))} disabled={!Number(pay) || !!busy} className="btn btn-gold shrink-0">Record payment</button>
        </div>
      )}
      {invoiceImportId && <Link href={`/admin/purchases/import-invoice/${invoiceImportId}`} className="block text-center text-xs font-bold text-gold underline">View scanned supplier invoice</Link>}
      {status === "confirmed" && <p className="text-center text-xs text-smoke">Received purchases are final. A wrong quantity is corrected with a stock adjustment (Inventory → Adjust), which is logged.</p>}
    </div>
  );
}
