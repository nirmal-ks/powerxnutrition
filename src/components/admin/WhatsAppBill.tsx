"use client";

import { useState } from "react";
import type { SaleView } from "@/lib/server/sales";
import { WhatsAppIcon } from "../ui/Icons";
import { receiptWhatsAppText, waLink } from "./Receipt";
import { Alert, api, Spinner } from "./ui";

/**
 * Type the customer's WhatsApp number → send the bill PDF.
 * auto=true  (WhatsApp Cloud API configured): the PDF is delivered automatically.
 * auto=false (free): WhatsApp opens with the message + PDF link ready; staff press send.
 */
export function WhatsAppBill({ sale, pdfUrl, auto }: { sale: SaleView; pdfUrl: string; auto: boolean }) {
  const [phone, setPhone] = useState(sale.customer_phone ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const digits = phone.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
  const valid = /^[6-9]\d{9}$/.test(digits);
  const text = receiptWhatsAppText(sale, pdfUrl);

  const send = async () => {
    if (!valid) return setMsg({ ok: false, text: "Enter a valid 10-digit WhatsApp number" });
    setMsg(null);
    if (!auto) {
      // open WhatsApp straight from the tap (browsers block pop-ups opened later)
      window.open(waLink(text, digits), "_blank", "noopener");
      api(`/api/admin/sales/${sale.id}/whatsapp`, { method: "POST", json: { phone: digits } }).catch(() => undefined);
      setMsg({ ok: true, text: "WhatsApp opened with the bill PDF link — press Send in WhatsApp." });
      return;
    }
    setBusy(true);
    try {
      await api(`/api/admin/sales/${sale.id}/whatsapp`, { method: "POST", json: { phone: digits } });
      setMsg({ ok: true, text: `Bill PDF sent to ${digits} on WhatsApp ✔` });
    } catch (e) {
      setMsg({ ok: false, text: `${(e as Error).message}. You can send it manually instead.` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 rounded-2xl border border-[#25d366]/30 bg-[#25d366]/[0.06] p-3">
      <p className="text-sm font-semibold">Send bill PDF on WhatsApp</p>
      <div className="flex gap-2">
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          inputMode="tel"
          maxLength={14}
          placeholder="Customer WhatsApp number"
          className="input py-3! text-lg"
          aria-label="Customer WhatsApp number"
        />
        <button onClick={send} disabled={busy || !digits} className="btn btn-whatsapp shrink-0 px-4!">
          {busy ? <Spinner /> : <WhatsAppIcon size={20} />} Send
        </button>
      </div>
      {msg && <Alert tone={msg.ok ? "ok" : "error"}>{msg.text}</Alert>}
      {msg && !msg.ok && valid && (
        <a href={waLink(text, digits)} target="_blank" rel="noopener" className="block text-center text-xs font-bold text-gold underline">Open WhatsApp with the PDF link</a>
      )}
      <div className="flex justify-between text-xs">
        <span className="text-smoke">{auto ? "PDF is delivered automatically." : "Free mode: customer gets a PDF download link."}</span>
        <a href={pdfUrl} target="_blank" rel="noopener" className="font-bold text-gold underline">⬇ View PDF</a>
      </div>
    </div>
  );
}
