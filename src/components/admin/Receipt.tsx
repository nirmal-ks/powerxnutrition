import { inr2 } from "@/lib/money";
import type { SaleView } from "@/lib/server/sales";

const METHOD: Record<string, string> = { cash: "Cash", upi: "UPI", card: "Card", other: "Other", cod: "Cash on delivery", razorpay: "Online (Razorpay)" };
const STATUS: Record<string, string> = {
  received: "Received",
  verified: "Verified by gateway",
  pending: "Pending",
  verifying: "Being verified",
  failed: "Failed",
  refunded: "Refunded",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** Same output on server and phone (no locale differences → no hydration errors). Always India time. */
const fmt = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 330 * 60_000);
  const h = d.getUTCHours();
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${h % 12 || 12}:${String(d.getUTCMinutes()).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

/** Printable receipt / GST tax invoice. Works on paper (80 mm or A4) and on screen. */
export function Receipt({ sale }: { sale: SaleView }) {
  const b = (sale.business ?? {}) as Record<string, string>;
  const isTax = sale.document_type === "tax_invoice";
  const cancelled = sale.status === "cancelled";
  return (
    <div className="receipt mx-auto w-full max-w-md rounded-2xl p-5 font-mono text-[13px] leading-snug shadow-xl print:max-w-none print:rounded-none print:p-0 print:shadow-none">
      <div className="text-center">
        <p className="text-lg font-bold">{b.tradeName || "PowerX Nutrition"}</p>
        {isTax && b.legalName && b.legalName !== b.tradeName && <p>{b.legalName}</p>}
        {b.address && <p className="text-[11px]">{b.address}</p>}
        {b.phone && <p className="text-[11px]">Ph: {b.phone}</p>}
        {isTax && b.gstin && <p className="font-bold">GSTIN: {b.gstin}</p>}
        <p className="mt-2 border-y border-dashed border-black py-1 font-bold tracking-widest">
          {isTax ? "TAX INVOICE" : "RECEIPT"}
          {cancelled ? " — CANCELLED" : ""}
        </p>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-2 text-[12px]">
        <span>Bill: <b>{sale.bill_no}</b></span>
        <span className="text-right">{fmt(sale.offline_created_at ?? sale.created_at)}</span>
        <span>{sale.channel === "ONLINE" ? `Online order ${sale.order_id ?? ""}` : `Cashier: ${sale.cashier_name}`}</span>
        <span className="text-right">{isTax ? `Place of supply: ${sale.place_of_supply}` : ""}</span>
        {(sale.customer_name || sale.customer_phone) && (
          <span className="col-span-2">Customer: {[sale.customer_name, sale.customer_phone].filter(Boolean).join(" · ")}</span>
        )}
      </div>
      <table className="mt-2 w-full border-t border-dashed border-black text-[12px]">
        <thead>
          <tr className="text-left">
            <th className="py-1 font-bold">Item</th>
            <th className="py-1 text-right font-bold">Qty</th>
            <th className="py-1 text-right font-bold">Rate</th>
            <th className="py-1 text-right font-bold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((i) => (
            <tr key={i.id} className="align-top">
              <td className="py-0.5 pr-1">
                {i.product_name} <span className="text-[11px]">({i.variant_label})</span>
                {isTax && <span className="block text-[10px]">HSN {i.hsn || "—"} · GST {i.tax_rate}%</span>}
                {i.returned_qty > 0 && <span className="block text-[10px] font-bold">Returned: {i.returned_qty}</span>}
              </td>
              <td className="py-0.5 text-right">{i.qty}</td>
              <td className="py-0.5 text-right">{inr2(i.unit_price)}</td>
              <td className="py-0.5 text-right">{inr2(i.unit_price * i.qty)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="mt-1 space-y-0.5 border-t border-dashed border-black pt-1 text-[12px]">
        <Row label="Subtotal" value={inr2(sale.subtotal)} />
        {sale.discount > 0 && <Row label="Discount" value={`− ${inr2(sale.discount)}`} />}
        {sale.delivery > 0 && <Row label="Delivery" value={inr2(sale.delivery)} />}
        {isTax && (
          <>
            <Row label={`Taxable value${sale.tax_mode === "inclusive" ? " (prices incl. GST)" : ""}`} value={inr2(sale.taxable_value + sale.delivery)} />
            {sale.igst > 0 ? <Row label="IGST" value={inr2(sale.igst)} /> : <><Row label="CGST" value={inr2(sale.cgst)} /><Row label="SGST" value={inr2(sale.sgst)} /></>}
          </>
        )}
        {sale.round_off !== 0 && <Row label="Round off" value={inr2(sale.round_off)} />}
        <div className="flex justify-between border-t border-black pt-1 text-base font-bold">
          <dt>TOTAL</dt>
          <dd>{inr2(sale.total)}</dd>
        </div>
      </dl>
      <div className="mt-2 border-t border-dashed border-black pt-1 text-[12px]">
        {sale.payments.filter((p) => p.direction === "in").map((p) => (
          <p key={p.id}>
            Paid by {METHOD[p.method] ?? p.method}: {inr2(p.amount)} — {STATUS[p.status] ?? p.status}
            {p.reference ? ` · Ref ${p.reference}` : ""}
          </p>
        ))}
        {sale.payments.filter((p) => p.direction === "in").length === 0 && <p>Payment: {sale.payment_status}</p>}
        {sale.payments.filter((p) => p.direction === "out").map((p) => (
          <p key={p.id} className="font-bold">Refunded {inr2(p.amount)} ({METHOD[p.method] ?? p.method})</p>
        ))}
        {sale.returns.map((r) => (
          <p key={r.id} className="text-[11px]">{r.kind === "void" ? "Cancelled" : "Return"} {r.return_no}: {r.reason}</p>
        ))}
      </div>
      {!isTax && <p className="mt-2 text-center text-[10px]">This is a sales receipt, not a GST tax invoice.</p>}
      {b.footer && <p className="mt-2 text-center text-[11px]">{b.footer}</p>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/** Prefilled WhatsApp message — staff reviews it in WhatsApp and presses send themselves. */
export function receiptWhatsAppText(sale: SaleView, link?: string) {
  const b = (sale.business ?? {}) as Record<string, string>;
  const lines = [
    `*${b.tradeName || "PowerX Nutrition"}* — ${sale.document_type === "tax_invoice" ? "Tax Invoice" : "Receipt"}`,
    `Bill: *${sale.bill_no}*`,
    `Date: ${fmt(sale.offline_created_at ?? sale.created_at)}`,
    "",
    ...sale.items.map((i, n) => `${n + 1}. ${i.product_name} (${i.variant_label}) × ${i.qty} = ${inr2(i.unit_price * i.qty)}`),
    "",
    `Subtotal: ${inr2(sale.subtotal)}`,
    sale.discount > 0 ? `Discount: − ${inr2(sale.discount)}` : "",
    sale.tax_total > 0 ? `GST: ${inr2(sale.tax_total)}` : "",
    `*Total: ${inr2(sale.total)}*`,
    `Paid: ${sale.payments.filter((p) => p.direction === "in").map((p) => `${METHOD[p.method] ?? p.method} ${inr2(p.amount)}`).join(" + ") || sale.payment_status}`,
    link ? `\n📄 Download your bill (PDF): ${link}` : "",
    b.footer ? `\n${b.footer}` : "",
  ];
  return lines.filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n").trim();
}

export const waLink = (text: string, phone?: string) => {
  const p = (phone ?? "").replace(/\D/g, "").slice(-10);
  return `https://wa.me/${p.length === 10 ? `91${p}` : ""}?text=${encodeURIComponent(text)}`;
};
