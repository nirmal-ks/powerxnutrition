"use client";

import { useEffect, useState } from "react";
import { cn, formatDate } from "@/lib/format";
import type { PublicReview, RatingSummary } from "@/types";
import { CheckIcon, CloseIcon, StarIcon } from "../ui/Icons";
import { Stars } from "../ui/Stars";

const CUSTOMER_KEY = "px_customer_v1";
const RATING_WORDS = ["", "Poor", "Okay", "Good", "Very good", "Excellent!"];

export function ProductReviews({ slug, productName, summary, reviews }: { slug: string; productName: string; summary: RatingSummary; reviews: PublicReview[] }) {
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState<null | { verified: boolean }>(null);
  const list = showAll ? reviews : reviews.slice(0, 4);

  return (
    <section id="reviews" className="mx-auto max-w-7xl scroll-mt-24 px-4 pt-16 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="font-display text-4xl">
          Customer <span className="text-gold-gradient">reviews</span>
        </h2>
        {!sent && (
          <button type="button" onClick={() => setOpen(true)} className="btn btn-gold">
            <StarIcon size={16} /> Write a review
          </button>
        )}
      </div>

      {sent && (
        <p className="mt-5 flex items-start gap-2 rounded-2xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-300" role="status">
          <CheckIcon size={18} className="mt-0.5 shrink-0" />
          Thank you! Your review will appear here once we&apos;ve checked it{sent.verified ? " — marked as a verified buyer ✅" : ""}.
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[20rem_1fr]">
        <div className="h-fit rounded-3xl border border-white/8 bg-gradient-to-b from-steel to-coal p-6">
          {summary.count ? (
            <>
              <div className="flex items-end gap-3">
                <span className="font-display text-6xl leading-none">{summary.average.toFixed(1)}</span>
                <div className="pb-1">
                  <Stars value={summary.average} size={18} />
                  <p className="mt-1 text-xs text-smoke">
                    {summary.count} review{summary.count > 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <ul className="mt-5 space-y-1.5">
                {summary.stars.map((n, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs">
                    <span className="w-6 text-right font-bold text-zinc-300">{5 - i}★</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/8">
                      <span className="block h-full rounded-full bg-gold" style={{ width: `${summary.count ? (n / summary.count) * 100 : 0}%` }} />
                    </span>
                    <span className="w-6 text-smoke">{n}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="text-center">
              <Stars value={0} size={24} />
              <p className="mt-3 font-semibold">No reviews yet</p>
              <p className="mt-1 text-sm text-smoke">Used {productName}? Be the first to share how it worked for you.</p>
            </div>
          )}
        </div>

        <div>
          {list.length ? (
            <ul className="space-y-3">
              {list.map((r) => (
                <li key={r.id} className="rounded-3xl border border-white/8 bg-white/[0.02] p-5">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Stars value={r.rating} size={15} />
                    {r.title && <p className="font-bold">{r.title}</p>}
                  </div>
                  <p className="mt-2 whitespace-pre-line leading-relaxed text-zinc-300">{r.text}</p>
                  <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-smoke">
                    <span className="font-semibold text-white">{r.name}</span>
                    {r.verified && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 font-bold text-green-400">
                        <CheckIcon size={12} strokeWidth={3} /> Verified buyer
                      </span>
                    )}
                    <span>· {formatDate(r.createdAt).split(",")[0]}</span>
                  </p>
                  {r.reply && (
                    <div className="mt-3 rounded-2xl border-l-2 border-gold bg-gold/[0.06] p-3 text-sm">
                      <p className="text-xs font-bold uppercase tracking-wider text-gold">Reply from PowerX</p>
                      <p className="mt-1 text-zinc-300">{r.reply}</p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex h-full min-h-40 items-center justify-center rounded-3xl border border-dashed border-white/10 p-8 text-center text-sm text-smoke">
              Reviews from customers will show up here.
            </div>
          )}
          {reviews.length > 4 && (
            <button type="button" onClick={() => setShowAll((s) => !s)} className="btn btn-ghost mt-4 w-full">
              {showAll ? "Show fewer" : `Show all ${reviews.length} reviews`}
            </button>
          )}
        </div>
      </div>

      {open && (
        <ReviewSheet
          slug={slug}
          productName={productName}
          onClose={() => setOpen(false)}
          onSent={(verified) => {
            setOpen(false);
            setSent({ verified });
          }}
        />
      )}
    </section>
  );
}

/** Bottom sheet on phones, centred dialog on bigger screens. */
function ReviewSheet({ slug, productName, onClose, onSent }: { slug: string; productName: string; onClose: () => void; onSent: (verified: boolean) => void }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CUSTOMER_KEY) || "null");
      if (saved?.name) setName(saved.name);
      if (saved?.phone) setPhone(saved.phone);
    } catch {}
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating) return setError("Tap the stars to rate the product");
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, rating, name, phone, title, text, website }),
      });
      const data = (await res.json()) as { verified?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error || "Couldn't send your review");
      onSent(Boolean(data.verified));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send your review");
      setBusy(false);
    }
  };

  const shown = hover || rating;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="review-title">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <form
        onSubmit={submit}
        className="animate-slide-up relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-white/10 bg-coal p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:max-w-lg sm:rounded-3xl sm:p-7"
      >
        <span className="mx-auto mb-4 block h-1.5 w-12 rounded-full bg-white/15 sm:hidden" aria-hidden />
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="review-title" className="font-display text-2xl">Rate this product</h3>
            <p className="line-clamp-1 text-sm text-smoke">{productName}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 rounded-full p-2 hover:bg-white/10">
            <CloseIcon size={20} />
          </button>
        </div>

        <div className="mt-5 flex flex-col items-center" onMouseLeave={() => setHover(0)}>
          <div className="flex gap-1" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} star${n > 1 ? "s" : ""}`}
                onClick={() => {
                  setRating(n);
                  setError("");
                }}
                onMouseEnter={() => setHover(n)}
                className={cn("p-1 transition-transform active:scale-90", n <= shown ? "text-gold" : "text-white/15")}
              >
                <StarIcon size={38} />
              </button>
            ))}
          </div>
          <p className="mt-1 h-5 text-sm font-bold text-gold">{RATING_WORDS[shown]}</p>
        </div>

        <div className="mt-4 space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Headline (e.g. Mixes well, great taste)" className="input" />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            maxLength={1000}
            required
            placeholder="How was the taste, mixing, results? Anything others should know?"
            className="input resize-none"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} placeholder="Your name" autoComplete="name" className="input" />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="Mobile (optional)" autoComplete="tel" className="input" />
          </div>
          <p className="text-[0.7rem] text-smoke">Add the mobile number you ordered with to get a “Verified buyer” badge. It&apos;s never shown publicly.</p>
          {/* honeypot for bots */}
          <input value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
        </div>

        {error && <p className="mt-3 rounded-xl border border-ember/40 bg-ember/10 p-3 text-sm text-ember" role="alert">{error}</p>}
        <button disabled={busy} className="btn btn-red shine mt-5 w-full py-4!">
          {busy ? "Sending…" : "Submit review"}
        </button>
      </form>
    </div>
  );
}
