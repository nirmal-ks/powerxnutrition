"use client";

import Image from "@/components/ui/Img";
import { useEffect, useRef, useState } from "react";
import { inr2 } from "@/lib/money";
import { SearchIcon } from "../../ui/Icons";
import { api } from "../ui";

export interface VariantHit {
  variant_id: string;
  name: string;
  brand: string;
  label: string;
  flavour: string;
  sku: string | null;
  barcode: string | null;
  price: number;
  stock: number;
  image: string;
  status: string;
  avg_cost?: number | null;
}

/** Type-ahead product search (name, brand, size, flavour, SKU, barcode). */
export function ProductLookup({ onPick, placeholder = "Search product, SKU or barcode…", autoFocus }: { onPick: (v: VariantHit) => void; placeholder?: string; autoFocus?: boolean }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<VariantHit[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!q.trim()) {
      setHits([]);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        const d = await api<{ results: VariantHit[] }>(`/api/admin/variants?q=${encodeURIComponent(q)}&limit=12`);
        setHits(d.results);
        setOpen(true);
        // a scanner types the exact barcode → pick it straight away
        if (d.results.length === 1 && (d.results[0].barcode === q.trim() || (d.results[0].sku ?? "").toUpperCase() === q.trim().toUpperCase())) pick(d.results[0]);
      } catch {
        setHits([]);
      }
    }, 220);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const pick = (v: VariantHit) => {
    onPick(v);
    setQ("");
    setHits([]);
    setOpen(false);
  };

  return (
    <div className="relative">
      <SearchIcon size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-smoke" />
      <input value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setOpen(true)} placeholder={placeholder} className="input pl-10 text-base" autoFocus={autoFocus} enterKeyHint="search" />
      {open && hits.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-xl border border-white/10 bg-steel shadow-2xl">
          {hits.map((h) => (
            <li key={h.variant_id}>
              <button type="button" onClick={() => pick(h)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-white/5">
                <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-gradient-to-b from-snow to-zinc-200">
                  {h.image && <Image src={h.image} alt="" fill sizes="40px" className="object-contain p-0.5 mix-blend-multiply" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{h.name}</span>
                  <span className="block text-xs text-smoke">
                    {[h.label, h.flavour].filter(Boolean).join(" · ")} · {h.brand}{h.sku ? ` · ${h.sku}` : ""} · stock {h.stock}
                  </span>
                </span>
                <span className="text-right text-xs">
                  <b className="block text-gold">{inr2(h.price)}</b>
                  {h.avg_cost !== undefined && h.avg_cost !== null && <span className="text-smoke">cost {inr2(h.avg_cost)}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && q.trim() && !hits.length && <p className="mt-1 text-xs text-smoke">No match. Use “New product” if this item isn&apos;t in the shop yet.</p>}
    </div>
  );
}
