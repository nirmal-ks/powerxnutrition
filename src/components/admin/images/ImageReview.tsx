"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/format";
import { Alert, api, Badge, Card, Empty, Spinner, useApi } from "../ui";

type QueueRow = { id: string; slug: string; name: string; brand: string; category: string; image: string; image_status: string; status: string; candidates: number; best_score: number | null; label: string; flavour: string };
type Candidate = { id: string; source: string; source_url: string; image_url: string; title: string; attribution: string; license: string; score: number; match_notes: string[]; ai_check: Record<string, string> | null; status: string };
type Detail = { product: { id: string; slug: string; name: string; brand: string; image: string; image_status: string; status: string }; variants: { label: string; flavour: string; sku: string | null; barcode: string | null }[]; candidates: Candidate[] };

const STATUS_TONE: Record<string, "gold" | "zinc" | "green"> = { REVIEW_REQUIRED: "gold", IMAGE_PENDING: "zinc", APPROVED: "green" };
const STATUS_LABEL: Record<string, string> = { REVIEW_REQUIRED: "Review required", IMAGE_PENDING: "Image pending", APPROVED: "Approved" };

export function ImageReview() {
  const sp = useSearchParams();
  const [status, setStatus] = useState("");
  const [openId, setOpenId] = useState<string | null>(sp.get("product"));
  const queue = useApi<{ products: QueueRow[]; sources: { openFoodFacts: boolean; google: boolean; aiCheck: boolean } }>(`/api/admin/images${status ? `?status=${status}` : ""}`);

  return (
    <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
      <div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {[["", "Needs a photo"], ["REVIEW_REQUIRED", "Review required"], ["IMAGE_PENDING", "Pending"], ["APPROVED", "Approved"]].map(([id, label]) => (
            <button key={id} onClick={() => setStatus(id)} className={cn("rounded-full border px-3 py-1.5 text-xs font-bold", status === id ? "border-transparent bg-blood text-white" : "border-white/10 text-zinc-400")}>{label}</button>
          ))}
        </div>
        {queue.data && (
          <p className="mb-2 text-[0.7rem] text-smoke">
            Sources: Open Food Facts {queue.data.sources.openFoodFacts ? "✔" : "off"} · Google {queue.data.sources.google ? "✔" : "not set up"} · AI check {queue.data.sources.aiCheck ? "✔" : "off"} · paste link ✔ · upload ✔
          </p>
        )}
        {queue.data && !queue.data.products.length && <Empty>Nothing here 🎉</Empty>}
        <ul className="max-h-[75vh] space-y-1.5 overflow-y-auto pr-1">
          {queue.data?.products.map((p) => (
            <li key={p.id}>
              <button onClick={() => setOpenId(p.id)} className={cn("flex w-full items-center gap-3 rounded-xl border p-2 text-left", openId === p.id ? "border-gold bg-gold/5" : "border-white/8 bg-coal hover:border-white/20")}>
                <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gradient-to-b from-snow to-zinc-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.image && <img src={p.image} alt="" className="h-full w-full object-contain mix-blend-multiply" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{p.brand} {p.name}</span>
                  <span className="block truncate text-[0.7rem] text-smoke">{p.label}{p.flavour ? ` · ${p.flavour}` : ""}</span>
                  <span className="mt-0.5 flex gap-1">
                    <Badge tone={STATUS_TONE[p.image_status]}>{STATUS_LABEL[p.image_status]}</Badge>
                    {p.candidates > 0 && <Badge tone="blue">{p.candidates} candidate(s)</Badge>}
                    {p.status !== "published" && <Badge>{p.status}</Badge>}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div>{openId ? <ProductImages id={openId} onChanged={queue.reload} aiCheck={Boolean(queue.data?.sources.aiCheck)} /> : <Empty>Choose a product on the left.</Empty>}</div>
    </div>
  );
}

function ProductImages({ id, onChanged, aiCheck }: { id: string; onChanged: () => void; aiCheck: boolean }) {
  const { data, reload, error } = useApi<Detail>(`/api/admin/images/${id}`);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [link, setLink] = useState({ imageUrl: "", sourceUrl: "" });

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    setMsg(null);
    try {
      const r = (await fn()) as { errors?: string[]; reason?: string; added?: number } | undefined;
      setMsg({ ok: true, text: r?.reason ?? (r?.added !== undefined ? `${ok} — ${r.added} new candidate(s)${r.errors?.length ? `. ${r.errors.join("; ")}` : ""}` : ok) });
      reload();
      onChanged();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy("");
    }
  };

  if (error) return <Alert>{error}</Alert>;
  if (!data) return <p className="p-8 text-center"><Spinner /></p>;
  const p = data.product;
  const approved = p.image_status === "APPROVED";

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap gap-4">
          <div className="h-36 w-36 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-b from-snow to-zinc-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {p.image ? <img src={p.image} alt="" className="h-full w-full object-contain p-2 mix-blend-multiply" /> : <span className="flex h-full items-center justify-center text-xs font-bold text-zinc-500">No photo — placeholder shown</span>}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl">{p.brand} {p.name}</h2>
            <p className="text-sm text-smoke">Exact item: {data.variants.map((v) => [v.label, v.flavour].filter(Boolean).join(" · ") + (v.barcode ? ` (barcode ${v.barcode})` : "")).join(" | ")}</p>
            <p className="mt-1"><Badge tone={STATUS_TONE[p.image_status]}>{STATUS_LABEL[p.image_status]}</Badge> {approved && <span className="text-xs text-smoke">— shown on the website</span>}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => run("search", () => api(`/api/admin/images/${id}`, { method: "POST", json: { action: "search", force: approved } }), "Search done")} disabled={!!busy} className="btn btn-gold px-4! py-2! text-xs!">
                {busy === "search" && <Spinner />} {approved ? "Find alternatives" : "Search for photos"}
              </button>
              <label className="btn btn-ghost cursor-pointer px-4! py-2! text-xs!">
                {busy === "upload" ? <Spinner /> : "📷"} Upload genuine photo
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const fd = new FormData();
                    fd.append("file", f);
                    run("upload", () => api(`/api/admin/images/${id}`, { method: "POST", body: fd }), "Photo uploaded — approve it below if it's the exact item");
                  }}
                />
              </label>
              {approved && (
                <button onClick={() => { const r = window.prompt("Why take this photo off the website? (e.g. wrong flavour)"); if (r) run("unpub", () => api(`/api/admin/images/${id}`, { method: "POST", json: { action: "unpublish", reason: r } }), "Photo removed from the website"); }} className="btn btn-ghost px-4! py-2! text-xs! text-ember!">
                  Remove from website
                </button>
              )}
            </div>
          </div>
        </div>
        {msg && <Alert tone={msg.ok ? "ok" : "error"} className="mt-3">{msg.text}</Alert>}
      </Card>

      <Card title="Add from a supplier / brand page">
        <p className="mb-2 text-xs text-smoke">Paste the image link from the brand&apos;s official site or your supplier&apos;s catalogue — only images you&apos;re allowed to use.</p>
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input value={link.imageUrl} onChange={(e) => setLink({ ...link, imageUrl: e.target.value })} placeholder="https://… image link (.jpg/.png/.webp)" className="input py-2!" />
          <input value={link.sourceUrl} onChange={(e) => setLink({ ...link, sourceUrl: e.target.value })} placeholder="Page it came from (optional)" className="input py-2!" />
          <button onClick={() => run("link", () => api(`/api/admin/images/${id}`, { method: "POST", json: { action: "link", ...link } }).then((r) => { setLink({ imageUrl: "", sourceUrl: "" }); return r; }), "Added as a candidate")} disabled={!link.imageUrl || !!busy} className="btn btn-ghost px-4! py-2! text-xs!">Add</button>
        </div>
      </Card>

      <Card title={`Candidates (${data.candidates.length})`}>
        {!data.candidates.length && <Empty>No candidates yet. Search, paste a link, or upload a photo. If nothing reliable exists, leave it — a clean placeholder is shown (never a fake photo).</Empty>}
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.candidates.map((c) => {
            const bad = c.match_notes?.some((n) => /different/.test(n));
            return (
              <li key={c.id} className={cn("overflow-hidden rounded-2xl border bg-coal", c.status === "approved" ? "border-green-500/50" : bad ? "border-ember/40" : "border-white/10")}>
                <div className="aspect-square bg-gradient-to-b from-snow to-zinc-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.image_url} alt={c.title} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-contain p-2 mix-blend-multiply" />
                </div>
                <div className="space-y-1 p-3 text-xs">
                  <p className="line-clamp-2 font-semibold">{c.title || "(no title)"}</p>
                  <p className="flex flex-wrap gap-1">
                    <Badge tone={c.score >= 85 ? "green" : c.score >= 60 ? "gold" : "red"}>match {Math.round(c.score)}%</Badge>
                    <Badge>{c.source}</Badge>
                    {c.status === "approved" && <Badge tone="green">approved</Badge>}
                  </p>
                  {c.match_notes?.length > 0 && <p className={bad ? "font-bold text-ember" : "text-gold"}>{c.match_notes.join(" · ")}</p>}
                  <p className="text-smoke">{c.attribution}{c.license ? ` · ${c.license}` : ""}</p>
                  {c.source_url && <a href={c.source_url} target="_blank" rel="noopener noreferrer" className="text-gold underline">source ↗</a>}
                  {c.ai_check && (
                    <p className="rounded bg-white/5 p-1.5 text-[0.65rem]">
                      AI check (advisory): brand {c.ai_check.brand} · size {c.ai_check.size} · flavour {c.ai_check.flavour}{c.ai_check.notes ? ` — ${c.ai_check.notes}` : ""}
                    </p>
                  )}
                  {c.status === "candidate" && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <button
                        onClick={() => (!bad || window.confirm("This photo seems to show a different size/flavour. Approve anyway?")) && run(`a${c.id}`, () => api(`/api/admin/images/candidates/${c.id}`, { method: "POST", json: { action: "approve" } }), "Approved — now shown on the website")}
                        disabled={!!busy}
                        className="flex-1 rounded-lg bg-green-600 px-2 py-2 font-bold text-white"
                      >
                        {busy === `a${c.id}` ? <Spinner /> : "✔ Approve"}
                      </button>
                      <button onClick={() => run(`r${c.id}`, () => api(`/api/admin/images/candidates/${c.id}`, { method: "POST", json: { action: "reject" } }), "Rejected")} disabled={!!busy} className="flex-1 rounded-lg border border-white/15 px-2 py-2 font-bold">
                        ✖ Reject
                      </button>
                      {aiCheck && (
                        <button onClick={() => run(`c${c.id}`, () => api(`/api/admin/images/candidates/${c.id}`, { method: "POST", json: { action: "ai-check" } }), "AI check done")} disabled={!!busy} className="w-full rounded-lg border border-white/15 px-2 py-1.5 font-bold text-zinc-300">
                          {busy === `c${c.id}` ? <Spinner /> : "Ask AI to double-check"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
