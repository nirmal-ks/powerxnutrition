"use client";

import qrcode from "qrcode-generator";
import { useMemo, useState } from "react";
import { siteConfig } from "@/config/site";
import { inr } from "@/lib/format";
import { upiLink } from "@/lib/upi";
import { CheckIcon, CopyIcon } from "../ui/Icons";

/** Dynamic UPI QR for the exact order amount + tap-to-pay button for phones. */
export function UpiQr({ amount, orderId }: { amount: number; orderId: string }) {
  const link = upiLink(amount, orderId);
  const [copied, setCopied] = useState(false);

  const path = useMemo(() => {
    const qr = qrcode(0, "Q"); // high error correction so the centre logo doesn't break scanning
    qr.addData(link);
    qr.make();
    const n = qr.getModuleCount();
    let d = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    return { d, n };
  }, [link]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(siteConfig.upi.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative rounded-3xl bg-snow p-4 shadow-[0_0_60px_-10px_rgba(245,183,0,0.5)]">
        <svg viewBox={`-2 -2 ${path.n + 4} ${path.n + 4}`} className="h-56 w-56 sm:h-64 sm:w-64" role="img" aria-label={`UPI QR code to pay ${inr(amount)}`} shapeRendering="crispEdges">
          <rect x="-2" y="-2" width={path.n + 4} height={path.n + 4} fill="#fff" />
          <path d={path.d} fill="#000" />
        </svg>
        <div className="font-display absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl border-4 border-white bg-black text-2xl italic text-blood">
          X
        </div>
      </div>
      <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-smoke">Scan with any UPI app</p>
      <p className="font-display mt-1 text-4xl text-gold">{inr(amount)}</p>
      <p className="mt-1 text-sm text-zinc-300">
        to <b>{siteConfig.upi.name}</b>
      </p>
      <button onClick={copy} className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:border-gold/50">
        {siteConfig.upi.id} {copied ? <CheckIcon size={14} className="text-green-400" /> : <CopyIcon size={14} />}
      </button>
      <a href={link} className="btn btn-gold mt-5 w-full sm:hidden">
        Pay {inr(amount)} with UPI app
      </a>
      <div className="mt-4 flex flex-wrap justify-center gap-2 text-[0.65rem] font-bold text-zinc-400">
        {["GPay", "PhonePe", "Paytm", "BHIM", "Any UPI"].map((a) => (
          <span key={a} className="rounded-md border border-white/10 px-2 py-1">{a}</span>
        ))}
      </div>
    </div>
  );
}
