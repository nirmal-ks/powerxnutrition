"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { productUrl } from "@/lib/catalog";
import { cn, formatDate } from "@/lib/format";
import type { Review, ReviewStatus } from "@/types";
import { CheckIcon, CloseIcon, TrashIcon } from "../ui/Icons";
import { Stars } from "../ui/Stars";

const TABS: (ReviewStatus | "all")[] = ["pending", "approved", "rejected", "all"];

export function ReviewsManager({ reviews: initial, names }: { reviews: Review[]; names: Record<string, string> }) {
  const [reviews, setReviews] = useState(initial);
  const [tab, setTab] = useState<(typeof TABS)[number]>(initial.some((r) => r.status === "pending") ? "pending" : "all");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const list = useMemo(() => reviews.filter((r) => tab === "all" || r.status === tab), [reviews, tab]);
  const count = (t: (typeof TABS)[number]) => (t === "all" ? reviews.length : reviews.filter((r) => r.status === t).length);

  const patch = async (id: string, body: Partial<Review>) => {
    setBusy(id);
    setError("");
    const res = await fetch(`/api/admin/reviews/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { review?: Review; error?: string };
    setBusy(null);
    if (!res.ok || !data.review) return setError(data.error || "Update failed");
    setReviews((prev) => prev.map((r) => (r.id === id ? data.review! : r)));
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this review permanently?")) return;
    const res = await fetch(`/api/admin/reviews/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) setReviews((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div>
      <div className="no-scrollbar mb-5 flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "shrink-0 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wider",
              tab === t ? "border-transparent bg-blood text-white" : "border-white/10 text-zinc-400 hover:text-white",
            )}
          >
            {t === "pending" ? "To approve" : t} ({count(t)})
          </button>
        ))}
      </div>
      {error && <p className="mb-4 rounded-xl border border-ember/40 bg-ember/10 p-3 text-sm text-ember">{error}</p>}

      {!list.length ? (
        <p className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-smoke">
          {tab === "pending" ? "Nothing to approve right now 👍" : "No reviews here yet."}
        </p>
      ) : (
        <ul className="space-y-3">
          {list.map((r) => (
            <li key={r.id} className={cn("rounded-2xl border bg-coal p-4 sm:p-5", r.status === "pending" ? "border-gold/40" : "border-white/8")}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={productUrl(r.slug)} target="_blank" className="text-xs font-bold uppercase tracking-wider text-gold hover:underline">
                    {names[r.slug] ?? r.slug} ↗
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Stars value={r.rating} size={15} />
                    {r.title && <b>{r.title}</b>}
                  </div>
                </div>
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider",
                    r.status === "approved" ? "border-green-500/30 bg-green-500/15 text-green-300" : r.status === "rejected" ? "border-zinc-500/30 bg-zinc-500/15 text-zinc-400" : "border-gold/40 bg-gold/15 text-gold",
                  )}
                >
                  {r.status}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-zinc-300">{r.text}</p>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-smoke">
                <b className="text-white">{r.name}</b>
                {r.phone && <a href={`tel:+91${r.phone}`} className="hover:text-white">{r.phone}</a>}
                {r.verified ? (
                  <span className="rounded-full bg-green-500/15 px-2 py-0.5 font-bold text-green-400">Verified buyer</span>
                ) : (
                  <span className="rounded-full bg-white/5 px-2 py-0.5">Not verified</span>
                )}
                <span>· {formatDate(r.createdAt)}</span>
              </p>

              <label className="mt-3 block">
                <span className="mb-1 block text-[0.65rem] font-bold uppercase tracking-widest text-smoke">Public reply (optional, saved when you click away)</span>
                <textarea
                  defaultValue={r.reply ?? ""}
                  onBlur={(e) => e.target.value.trim() !== (r.reply ?? "") && patch(r.id, { reply: e.target.value })}
                  rows={2}
                  placeholder="Thanks for the review! …"
                  className="input resize-none text-sm"
                />
              </label>

              <div className="mt-3 flex flex-wrap gap-2">
                {r.status !== "approved" && (
                  <button disabled={busy === r.id} onClick={() => patch(r.id, { status: "approved" })} className="btn btn-gold py-2! text-xs!">
                    <CheckIcon size={14} /> Approve
                  </button>
                )}
                {r.status !== "rejected" && (
                  <button disabled={busy === r.id} onClick={() => patch(r.id, { status: "rejected" })} className="btn btn-ghost py-2! text-xs!">
                    <CloseIcon size={14} /> {r.status === "approved" ? "Hide" : "Reject"}
                  </button>
                )}
                <button onClick={() => remove(r.id)} className="ml-auto inline-flex items-center gap-1 rounded-full px-3 py-2 text-xs font-bold text-smoke hover:text-ember">
                  <TrashIcon size={14} /> Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
