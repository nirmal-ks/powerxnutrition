"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCan } from "../SessionContext";
import { Alert, api, Badge, Card, Empty, fmtDate, Spinner } from "../ui";

type Row = { id: string; status: string; file_name: string; provider: string; invoice_no: string; supplier_name: string | null; purchase_no: string | null; created_at: string; lines: number; issues: number };

export function InvoiceUpload({ invoices, ai }: { invoices: Row[]; ai: { label: string; external: boolean; allowed: boolean } | null }) {
  const router = useRouter();
  const can = useCan();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const d = await api<{ id: string; sameFileAs: { id: string } | null }>("/api/admin/invoices", { method: "POST", body: fd });
      router.push(`/admin/purchases/import-invoice/${d.id}${d.sameFileAs ? `?same=${d.sameFileAs.id}` : ""}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-3 text-sm">
          {ai ? (
            ai.allowed ? (
              <Alert tone="ok">AI reading is ON: {ai.label}{ai.external ? " (invoice is sent to this service)" : " (runs on your own computer)"}. You still check every value before confirming.</Alert>
            ) : (
              <Alert tone="warn">
                {ai.label} is configured, but the owner hasn&apos;t allowed sending invoices to it. {can("settings.manage") ? <Link href="/admin/settings" className="underline">Allow in Settings → AI</Link> : "Ask the owner."} Until then the free no-AI text reader is used.
              </Alert>
            )
          ) : (
            <Alert tone="info">No AI configured — the invoice is read with the free built-in text reader (works best on clear PDFs; photos use free OCR in your browser). For better results add a free Google Gemini key (see README).</Alert>
          )}
        </div>
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/15 p-8 text-center hover:border-gold/50">
          <span className="font-display text-2xl">📄 Choose invoice</span>
          <span className="mt-1 text-sm text-smoke">PDF, JPG, PNG or WEBP · up to 10 MB · on a phone you can take a photo</span>
          <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" capture="environment" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="sr-only" />
          {file && <span className="mt-3 rounded-lg bg-white/10 px-3 py-1 text-sm">{file.name} · {(file.size / 1024).toFixed(0)} KB</span>}
        </label>
        {err && <Alert className="mt-3">{err}</Alert>}
        <button onClick={upload} disabled={!file || busy} className="btn btn-red mt-3 w-full">{busy && <Spinner />} Upload & read</button>
        <p className="mt-2 text-center text-xs text-smoke">Invoices are stored privately — only logged-in staff can open them.</p>
      </Card>
      <Card title="Recent invoices">
        {!invoices.length ? (
          <Empty>No invoices uploaded yet.</Empty>
        ) : (
          <ul className="divide-y divide-white/5 text-sm">
            {invoices.map((i) => (
              <li key={i.id}>
                <Link href={`/admin/purchases/import-invoice/${i.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2.5 hover:text-gold">
                  <span>
                    {i.supplier_name ?? i.file_name} {i.invoice_no && <span className="text-smoke">· {i.invoice_no}</span>}
                    <span className="block text-xs text-smoke">{fmtDate(i.created_at)} · {i.lines} line(s) · read by {i.provider || "—"}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    {i.issues > 0 && i.status === "extracted" && <Badge tone="red">{i.issues} issue(s)</Badge>}
                    <Badge tone={i.status === "confirmed" ? "green" : i.status === "extracted" ? "gold" : "zinc"}>{i.status === "extracted" ? "to review" : i.status === "confirmed" ? `received ${i.purchase_no ?? ""}` : i.status}</Badge>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
