"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { productUrl } from "@/lib/catalog";
import { inr } from "@/lib/format";
import { whatsappLink } from "@/lib/whatsapp";
import type { CategorySlug } from "@/types";
import { CheckIcon, CopyIcon, WhatsAppIcon } from "../ui/Icons";
import { ProductImage } from "./ProductImage";

/** Share the product: native share sheet on phones, WhatsApp + copy link everywhere. */
export function ShareProduct({ name, slug }: { name: string; slug: string }) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator.share === "function"), []);

  const url = () => `${window.location.origin}${productUrl(slug)}`;
  const text = `Check out ${name} at PowerX Nutrition 💪`;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-zinc-300">
      <span className="text-smoke">Share:</span>
      {canShare && (
        <button type="button" onClick={() => navigator.share({ title: name, text, url: url() }).catch(() => {})} className="rounded-full border border-white/10 px-3 py-1.5 transition hover:border-gold/50">
          📤 Share
        </button>
      )}
      <button
        type="button"
        onClick={() => window.open(whatsappLink(`${text}\n${url()}`, ""), "_blank", "noopener")}
        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 transition hover:border-[#25d366]/60"
      >
        <WhatsAppIcon size={14} className="text-[#25d366]" /> WhatsApp a friend
      </button>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url());
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {}
        }}
        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 transition hover:border-gold/50"
      >
        {copied ? <CheckIcon size={14} className="text-green-400" /> : <CopyIcon size={14} />} {copied ? "Copied!" : "Copy link"}
      </button>
    </div>
  );
}

type Seen = { slug: string; name: string; brand: string; category: CategorySlug; image: string; price: number };
const KEY = "px_recent_v1";

/** Remembers this product and shows the others the visitor looked at recently (stored in this browser only). */
export function RecentlyViewed({ current }: { current: Seen }) {
  const [list, setList] = useState<Seen[]>([]);

  useEffect(() => {
    try {
      const saved = (JSON.parse(localStorage.getItem(KEY) || "[]") as Seen[]).filter((p) => p?.slug && p.slug !== current.slug);
      setList(saved.slice(0, 6));
      localStorage.setItem(KEY, JSON.stringify([current, ...saved].slice(0, 12)));
    } catch {}
  }, [current.slug]); // only re-run for a different product

  if (!list.length) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6">
      <div className="flex items-end justify-between gap-4">
        <h2 className="font-display text-3xl">Recently <span className="text-gold-gradient">viewed</span></h2>
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.setItem(KEY, JSON.stringify([current]));
            } catch {}
            setList([]);
          }}
          className="text-xs text-smoke underline hover:text-white"
        >
          Clear
        </button>
      </div>
      <ul className="no-scrollbar mt-5 flex snap-x gap-3 overflow-x-auto pb-2">
        {list.map((p) => (
          <li key={p.slug} className="w-40 shrink-0 snap-start sm:w-48">
            <Link href={productUrl(p.slug)} className="group block rounded-2xl border border-white/8 bg-coal p-3 transition hover:border-gold/40">
              <span className="relative block aspect-square overflow-hidden rounded-xl bg-gradient-to-b from-snow to-zinc-200">
                <ProductImage src={p.image} alt={p.name} brand={p.brand} category={p.category} sizes="192px" className="p-2 mix-blend-multiply transition group-hover:scale-105" />
              </span>
              <span className="mt-2 block text-[0.65rem] font-bold uppercase tracking-wider text-gold">{p.brand}</span>
              <span className="line-clamp-2 block text-sm font-semibold leading-snug">{p.name}</span>
              <span className="mt-1 block text-sm font-bold">{inr(p.price)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
