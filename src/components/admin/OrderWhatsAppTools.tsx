"use client";

import { useState } from "react";
import { siteConfig } from "@/config/site";
import { inr } from "@/lib/format";
import type { Order } from "@/types";
import { WhatsAppIcon } from "../ui/Icons";
import { Alert, api, Spinner } from "./ui";

/** WhatsApp helpers for one online order: bill PDF and UPI payment reminder. */
export function OrderWhatsAppTools({ order }: { order: Order }) {
  const [phone, setPhone] = useState(order.customer.phone);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const digits = phone.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
  const cancelled = order.status === "cancelled";
  const awaitingUpi = order.paymentMethod === "upi" && order.paymentStatus !== "paid" && order.paymentStatus !== "refunded" && !cancelled;

  const sendBill = async () => {
    if (!/^[6-9]\d{9}$/.test(digits)) return setMsg({ ok: false, text: "Enter a valid 10-digit WhatsApp number" });
    // open the tab inside the tap so the browser doesn't block it; filled in after the server answers
    const tab = window.open("", "_blank");
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ sent: boolean; waUrl: string; billNo: string }>(`/api/admin/orders/${encodeURIComponent(order.id)}/whatsapp-bill`, { method: "POST", json: { phone: digits } });
      if (r.sent) {
        tab?.close();
        setMsg({ ok: true, text: `Bill ${r.billNo} PDF sent to ${digits} on WhatsApp ✔` });
      } else {
        if (tab) tab.location.href = r.waUrl;
        else window.location.href = r.waUrl;
        setMsg({ ok: true, text: "WhatsApp opened with the bill PDF link — press Send." });
      }
    } catch (e) {
      tab?.close();
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const reminder = [
    `Hi ${order.customer.name.split(" ")[0]}, your ${siteConfig.name} order *${order.id}* for *${inr(order.total)}* is waiting for payment.`,
    ``,
    `Pay by UPI to: *${siteConfig.upi.id}* (${siteConfig.upi.name})`,
    `After paying, enter the UTR number here: ${siteConfig.url}/track-order?id=${order.id}`,
    ``,
    `Already paid? Just reply with the payment screenshot. Thank you! 💪`,
  ].join("\n");

  if (cancelled) return null;
  return (
    <div className="space-y-2 rounded-2xl border border-[#25d366]/30 bg-[#25d366]/[0.06] p-3">
      {order.billNo ? (
        <>
          <p className="text-xs font-bold uppercase tracking-widest text-smoke">Send bill PDF ({order.billNo})</p>
          <div className="flex gap-2">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" maxLength={14} className="input py-2!" aria-label="WhatsApp number" />
            <button onClick={sendBill} disabled={busy} className="btn btn-whatsapp shrink-0 px-3! py-2! text-xs!">
              {busy ? <Spinner /> : <WhatsAppIcon size={16} />} Send
            </button>
          </div>
        </>
      ) : (
        <p className="text-xs text-smoke">The bill is created when the order is confirmed (stock taken). Then you can send the bill PDF here.</p>
      )}
      {awaitingUpi && (
        <a href={`https://wa.me/91${order.customer.phone}?text=${encodeURIComponent(reminder)}`} target="_blank" rel="noopener" className="btn btn-ghost w-full py-2! text-xs!">
          💸 Send UPI payment reminder
        </a>
      )}
      {msg && <Alert tone={msg.ok ? "ok" : "error"}>{msg.text}</Alert>}
    </div>
  );
}
