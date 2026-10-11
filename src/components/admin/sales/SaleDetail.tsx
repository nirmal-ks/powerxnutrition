"use client";

import Link from "next/link";
import { useState } from "react";
import { inr2 } from "@/lib/money";
import type { SaleView } from "@/lib/server/sales";
import { Receipt } from "../Receipt";
import { WhatsAppBill } from "../WhatsAppBill";
import { Alert, api, Card, Spinner } from "../ui";

export function SaleDetail({
  sale: initial,
  receiptUrl,
  pdfUrl,
  whatsappAuto,
  canReturn,
  canVoid,
}: {
  sale: SaleView;
  receiptUrl: string;
  pdfUrl: string;
  whatsappAuto: boolean;
  canReturn: boolean;
  canVoid: boolean;
}) {
  const [sale, setSale] = useState(initial);
  const [mode, setMode] = useState<"none" | "return" | "void">("none");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [restock, setRestock] = useState<Record<string, boolean>>({});
  const [reason, setReason] = useState("");
  const [refundMethod, setRefundMethod] = useState("cash");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [txn] = useState(() => (crypto && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now())));
  const open = sale.status !== "cancelled" && sale.status !== "returned";

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const body =
        mode === "void"
          ? { action: "void", reason, refundMethod }
          : { action: "return", reason, refundMethod, clientTxnId: txn, items: Object.entries(qty).filter(([, q]) => q > 0).map(([saleItemId, q]) => ({ saleItemId, qty: q, restock: restock[saleItemId] !== false })) };
      const d = await api<{ sale: SaleView; refund: number; returnNo: string }>(`/api/admin/sales/${sale.id}`, { method: "POST", json: body });
      setSale(d.sale);
      setMode("none");
      setQty({});
      setReason("");
      setMsg({ ok: true, text: `${d.returnNo} saved · refund ${inr2(d.refund)} · stock updated` });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div>
        <Link href="/admin/sales" className="mb-3 inline-block text-xs font-bold uppercase tracking-widest text-smoke hover:text-white print:hidden">← Bills</Link>
        <Receipt sale={sale} />
        <div className="mx-auto mt-4 max-w-md space-y-2 print:hidden">
          <WhatsAppBill sale={sale} pdfUrl={pdfUrl} auto={whatsappAuto} />
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => window.print()} className="btn btn-ghost py-3!">🖨 Print</button>
            <a href={pdfUrl} target="_blank" rel="noopener" className="btn btn-ghost py-3!">⬇ PDF</a>
          </div>
          <a href={receiptUrl} target="_blank" rel="noopener" className="block text-center text-xs text-smoke underline">Open customer receipt page ↗</a>
        </div>
      </div>

      <div className="space-y-4 print:hidden">
        {msg && <Alert tone={msg.ok ? "ok" : "error"}>{msg.text}</Alert>}
        {sale.order_id && (
          <Alert tone="info">
            Online order <Link className="font-bold underline" href={`/admin/orders?open=${sale.order_id}`}>{sale.order_id}</Link> — cancel online orders from the Orders page.
          </Alert>
        )}
        {sale.items.some((i) => i.unit_cost !== undefined) && (
          <Card title="Profit on this bill">
            {(() => {
              const known = sale.items.every((i) => i.unit_cost !== null);
              const cost = sale.items.reduce((s, i) => s + (i.qty - i.returned_qty) * (i.unit_cost ?? 0), 0);
              const net = sale.items.reduce((s, i) => s + (i.taxable_value * (i.qty - i.returned_qty)) / i.qty, 0);
              return (
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between"><dt>Net sale (excl. GST)</dt><dd>{inr2(net)}</dd></div>
                  <div className="flex justify-between"><dt>Cost (at time of sale)</dt><dd>{inr2(cost)}</dd></div>
                  <div className="flex justify-between font-bold"><dt>Gross profit</dt><dd className="text-green-400">{inr2(net - cost)}</dd></div>
                  {!known && <p className="text-xs text-gold">Some items had no purchase cost recorded — profit is overstated.</p>}
                </dl>
              );
            })()}
          </Card>
        )}
        {open && !sale.order_id && (canReturn || canVoid) && mode === "none" && (
          <Card title="Return or cancel">
            <p className="mb-3 text-xs text-smoke">The original bill is never edited. A return/cancellation document is created, stock goes back and the refund is recorded.</p>
            <div className="flex flex-wrap gap-2">
              {canReturn && <button onClick={() => setMode("return")} className="btn btn-ghost flex-1 py-3!">Return items</button>}
              {canVoid && sale.returns.length === 0 && <button onClick={() => setMode("void")} className="btn btn-ghost flex-1 py-3! text-ember!">Cancel bill</button>}
            </div>
          </Card>
        )}
        {mode !== "none" && (
          <Card title={mode === "void" ? "Cancel this bill" : "Return items"}>
            {mode === "return" && (
              <ul className="mb-3 space-y-2">
                {sale.items.map((i) => {
                  const left = i.qty - i.returned_qty;
                  return (
                    <li key={i.id} className="rounded-xl border border-white/8 p-2 text-sm">
                      <p className="font-semibold">{i.product_name} <span className="text-smoke">({i.variant_label})</span></p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-xs text-smoke">Return</span>
                        <input type="number" min={0} max={left} value={qty[i.id] ?? 0} onChange={(e) => setQty((q) => ({ ...q, [i.id]: Math.max(0, Math.min(left, Number(e.target.value) || 0)) }))} className="input w-20! py-1.5!" disabled={!left} />
                        <span className="text-xs text-smoke">of {left}</span>
                        <label className="ml-auto flex items-center gap-1 text-xs">
                          <input type="checkbox" checked={restock[i.id] !== false} onChange={(e) => setRestock((r) => ({ ...r, [i.id]: e.target.checked }))} /> back to stock
                        </label>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <label className="block text-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Reason *</span>
              <input value={reason} onChange={(e) => setReason(e.target.value)} className="input mt-1" placeholder={mode === "void" ? "e.g. Wrong bill, customer cancelled" : "e.g. Seal damaged, wrong flavour"} />
            </label>
            <label className="mt-2 block text-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Refund by</span>
              <select value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)} className="input mt-1">
                {["cash", "upi", "card", "other", "none"].map((m) => <option key={m} value={m} className="bg-coal">{m === "none" ? "No refund (exchange/credit)" : m.toUpperCase()}</option>)}
              </select>
            </label>
            <div className="mt-3 flex gap-2">
              <button onClick={() => setMode("none")} className="btn btn-ghost flex-1">Back</button>
              <button onClick={submit} disabled={busy || reason.trim().length < 3 || (mode === "return" && !Object.values(qty).some((q) => q > 0))} className="btn btn-red flex-1">
                {busy && <Spinner />} {mode === "void" ? "Cancel bill" : "Save return"}
              </button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
