"use client";

import Image from "@/components/ui/Img";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { cn } from "@/lib/format";
import { inr2 } from "@/lib/money";
import type { BatchRow, InventoryRow, MovementRow } from "@/lib/server/inventory";
import { SearchIcon } from "../../ui/Icons";
import { useCan } from "../SessionContext";
import { Alert, api, Badge, Empty, fmtDate, fmtDay, Freshness, Modal, PageHeader, Spinner, Stat, useApi } from "../ui";

const MOVE_LABEL: Record<string, { label: string; tone: "green" | "red" | "gold" | "blue" | "purple" | "zinc" }> = {
  OPENING: { label: "Opening", tone: "zinc" },
  PURCHASE_RECEIPT: { label: "Received", tone: "green" },
  SALE_OFFLINE: { label: "Shop sale", tone: "purple" },
  SALE_ONLINE: { label: "Online sale", tone: "blue" },
  RETURN: { label: "Return", tone: "gold" },
  CANCELLATION: { label: "Cancelled", tone: "gold" },
  ADJUSTMENT: { label: "Adjustment", tone: "red" },
};

type Valuation = { units: number; cost_value: number; retail_value: number; no_cost_units: number; low: number; out: number; skus: number };

export function InventoryView({ brands, categories, suppliers }: { brands: string[]; categories: { slug: string; name: string }[]; suppliers: { id: string; name: string; phone?: string }[] }) {
  const sp = useSearchParams();
  const can = useCan();
  const [tab, setTab] = useState<"stock" | "movements" | "batches">((sp.get("tab") as "stock") ?? "stock");
  const [f, setF] = useState({ q: "", brand: "", category: "", supplier: "", low: sp.get("low") === "1", expiring: "" });
  const [adjust, setAdjust] = useState<InventoryRow | null>(null);
  const [historyFor, setHistoryFor] = useState<InventoryRow | null>(null);
  const [reorder, setReorder] = useState(false);

  const stockUrl = useMemo(() => {
    const p = new URLSearchParams();
    if (f.q) p.set("q", f.q);
    if (f.brand) p.set("brand", f.brand);
    if (f.category) p.set("category", f.category);
    if (f.supplier) p.set("supplier", f.supplier);
    if (f.low) p.set("low", "1");
    if (f.expiring) p.set("expiring", f.expiring);
    return `/api/admin/inventory?${p}`;
  }, [f]);
  const stock = useApi<{ items: (InventoryRow & { avg_cost?: number | null })[]; valuation: Valuation | null; checkedAt: string }>(tab === "stock" ? stockUrl : null, { pollMs: 60_000 });

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle="One stock for the website and the shop. Every change is a recorded movement."
        actions={
          <>
            {can("purchases.create") && <Link href="/admin/inventory/stock-in" className="btn btn-red px-4! py-2.5! text-sm!">+ Receive stock</Link>}
            {can("purchases.create") && <Link href="/admin/inventory/import" className="btn btn-ghost px-4! py-2.5! text-sm!">Excel import</Link>}
          </>
        }
      />
      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
        {(["stock", "movements", "batches"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn("shrink-0 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wider", tab === t ? "border-transparent bg-blood text-white" : "border-white/10 text-zinc-400")}>
            {t === "stock" ? "Current stock" : t === "movements" ? "Movement history" : "Batches & expiry"}
          </button>
        ))}
      </div>

      {tab === "stock" && (
        <>
          {stock.data?.valuation && (
            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Units in stock" value={stock.data.valuation.units} hint={`${stock.data.valuation.skus} sizes/flavours`} />
              <Stat label="Stock value at cost" value={inr2(stock.data.valuation.cost_value)} hint={stock.data.valuation.no_cost_units ? `${stock.data.valuation.no_cost_units} units have no cost yet` : "Money tied up in stock"} tone="text-gold" />
              <Stat label="Retail value" value={inr2(stock.data.valuation.retail_value)} hint="If everything sold at today's price — not profit" />
              <Stat label="Low / out of stock" value={`${stock.data.valuation.low} / ${stock.data.valuation.out}`} tone="text-ember" />
            </div>
          )}
          <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
            <label className="relative sm:col-span-2">
              <SearchIcon size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-smoke" />
              <input value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Product, SKU, barcode…" className="input pl-10" />
            </label>
            <select value={f.brand} onChange={(e) => setF({ ...f, brand: e.target.value })} className="input">
              <option value="" className="bg-coal">All brands</option>
              {brands.map((b) => <option key={b} value={b} className="bg-coal">{b}</option>)}
            </select>
            <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} className="input">
              <option value="" className="bg-coal">All categories</option>
              {categories.map((c) => <option key={c.slug} value={c.slug} className="bg-coal">{c.name}</option>)}
            </select>
            <select value={f.supplier} onChange={(e) => setF({ ...f, supplier: e.target.value })} className="input">
              <option value="" className="bg-coal">All suppliers</option>
              {suppliers.map((s) => <option key={s.id} value={s.id} className="bg-coal">{s.name}</option>)}
            </select>
            <div className="flex gap-2">
              <button onClick={() => setF({ ...f, low: !f.low })} className={cn("flex-1 rounded-xl border px-2 text-xs font-bold", f.low ? "border-gold bg-gold/15 text-gold" : "border-white/10 text-zinc-400")}>Low</button>
              <button onClick={() => setF({ ...f, expiring: f.expiring ? "" : "60" })} className={cn("flex-1 rounded-xl border px-2 text-xs font-bold", f.expiring ? "border-gold bg-gold/15 text-gold" : "border-white/10 text-zinc-400")}>Expiring</button>
            </div>
          </div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <Freshness at={stock.updatedAt} error={stock.error} onRefresh={stock.reload} />
            <span className="flex items-center gap-3">
              {can("purchases.create") && (
                <button onClick={() => setReorder(true)} className="text-xs font-bold text-[#25d366]">📲 Reorder low stock on WhatsApp</button>
              )}
              <a href={`${stockUrl}&format=csv`} className="text-xs font-bold text-gold">⬇ Export CSV</a>
            </span>
          </div>
          {stock.loading && !stock.data && <p className="p-6 text-center text-smoke"><Spinner /></p>}
          {stock.data && !stock.data.items.length && <Empty>No products match.</Empty>}
          <ul className="space-y-2">
            {stock.data?.items.map((r) => {
              const low = r.stock <= r.min_stock;
              const daysLeft = r.next_expiry ? Math.round((Date.parse(r.next_expiry) - Date.now()) / 86400_000) : null;
              return (
                <li key={r.variant_id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/8 bg-coal p-3">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gradient-to-b from-snow to-zinc-200">
                    {r.image && r.image_status === "APPROVED" ? <Image src={r.image} alt="" fill sizes="48px" className="object-contain p-0.5 mix-blend-multiply" /> : <span className="flex h-full items-center justify-center text-[0.5rem] font-bold text-zinc-500">NO IMG</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {r.name} <span className="font-normal text-smoke">· {[r.label, r.flavour].filter(Boolean).join(" · ")}</span>
                    </p>
                    <p className="text-xs text-smoke">
                      {r.brand}{r.sku ? ` · ${r.sku}` : ""}{r.barcode ? ` · ${r.barcode}` : ""} · sell {inr2(r.price)}
                      {r.avg_cost !== undefined && <> · cost {r.avg_cost === null ? <b className="text-gold">not set</b> : inr2(r.avg_cost)}</>}
                      {r.supplier_name ? ` · ${r.supplier_name}` : ""}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {r.status !== "published" && <Badge>{r.status}</Badge>}
                      {r.batch_count > 0 && <Badge tone="blue">{r.batch_count} batch{r.batch_count > 1 ? "es" : ""}</Badge>}
                      {daysLeft !== null && daysLeft <= 60 && <Badge tone={daysLeft < 0 ? "red" : "gold"}>{daysLeft < 0 ? "expired batch" : `expires in ${daysLeft}d`} ({r.expiring_qty})</Badge>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className={cn("font-display text-3xl leading-none", r.stock <= 0 ? "text-ember" : low ? "text-gold" : "text-green-300")}>{r.stock}</p>
                      <p className="text-[0.65rem] text-smoke">min {r.min_stock}</p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button onClick={() => setHistoryFor(r)} className="rounded-lg border border-white/10 px-2 py-1 text-[0.7rem] font-bold text-zinc-300">History</button>
                      {can("inventory.adjust") && <button onClick={() => setAdjust(r)} className="rounded-lg border border-white/10 px-2 py-1 text-[0.7rem] font-bold text-zinc-300">Adjust</button>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {tab === "movements" && <Movements />}
      {tab === "batches" && <Batches />}
      {adjust && <AdjustDialog row={adjust} onClose={() => setAdjust(null)} onDone={() => { setAdjust(null); stock.reload(); }} />}
      {historyFor && <HistoryDialog row={historyFor} onClose={() => setHistoryFor(null)} />}
      {reorder && <ReorderDialog suppliers={suppliers} onClose={() => setReorder(false)} />}
    </div>
  );
}

function Movements({ variantId }: { variantId?: string }) {
  const [f, setF] = useState({ q: "", type: "", from: "", to: "" });
  const url = useMemo(() => {
    const p = new URLSearchParams({ view: "movements" });
    if (variantId) p.set("variant", variantId);
    Object.entries(f).forEach(([k, v]) => v && p.set(k, v));
    return `/api/admin/inventory?${p}`;
  }, [f, variantId]);
  const { data, error, loading } = useApi<{ movements: MovementRow[] }>(url);
  return (
    <div>
      {!variantId && (
        <div className="mb-3 grid gap-2 sm:grid-cols-4">
          <input value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Product, bill no, PO no…" className="input" />
          <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} className="input">
            <option value="" className="bg-coal">All movement types</option>
            {Object.entries(MOVE_LABEL).map(([k, v]) => <option key={k} value={k} className="bg-coal">{v.label}</option>)}
          </select>
          <input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} className="input" aria-label="From" />
          <input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} className="input" aria-label="To" />
        </div>
      )}
      {!variantId && <a href={`${url}&format=csv`} className="mb-2 inline-block text-xs font-bold text-gold">⬇ Export CSV</a>}
      {error && <Alert>{error}</Alert>}
      {loading && !data && <p className="p-4 text-center"><Spinner /></p>}
      {data && !data.movements.length && <Empty>No movements.</Empty>}
      <ul className="divide-y divide-white/5 rounded-2xl border border-white/8 bg-coal">
        {data?.movements.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-2 p-3 text-sm">
            <span className={cn("w-14 text-right font-display text-xl", m.qty_change > 0 ? "text-green-300" : "text-ember")}>{m.qty_change > 0 ? `+${m.qty_change}` : m.qty_change}</span>
            <div className="min-w-0 flex-1">
              {!variantId && <p className="truncate font-semibold">{m.product_name} <span className="font-normal text-smoke">({[m.label, m.flavour].filter(Boolean).join(", ")})</span></p>}
              <p className="text-xs text-smoke">
                <Badge tone={MOVE_LABEL[m.type]?.tone}>{MOVE_LABEL[m.type]?.label ?? m.type}</Badge> {m.ref_label ?? ""} {m.batch_no ? `· batch ${m.batch_no}` : ""} · {m.user_name} · {fmtDate(m.created_at)}
              </p>
              {m.note && <p className="text-[0.7rem] text-zinc-400">{m.note}</p>}
            </div>
            <span className="text-xs text-smoke">→ {m.stock_after}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Batches() {
  const [days, setDays] = useState("");
  const { data, error } = useApi<{ batches: BatchRow[] }>(`/api/admin/inventory?view=batches${days ? `&expiring=${days}` : ""}`);
  return (
    <div>
      <div className="mb-3 flex gap-2">
        {["", "30", "60", "90"].map((d) => (
          <button key={d} onClick={() => setDays(d)} className={cn("rounded-full border px-3 py-1.5 text-xs font-bold", days === d ? "border-transparent bg-blood text-white" : "border-white/10 text-zinc-400")}>
            {d ? `Expiring ≤ ${d} days` : "All batches in stock"}
          </button>
        ))}
      </div>
      {error && <Alert>{error}</Alert>}
      {data && !data.batches.length && <Empty>No batches. Batches are created when stock is received through a purchase.</Empty>}
      <div className="overflow-x-auto rounded-2xl border border-white/8">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-white/5 text-left text-xs text-smoke">
            <tr><th className="p-2">Product</th><th className="p-2">Batch</th><th className="p-2">Expiry</th><th className="p-2 text-right">Left / recd</th><th className="p-2">Supplier · PO</th></tr>
          </thead>
          <tbody>
            {data?.batches.map((b) => {
              const daysLeft = b.expiry_date ? Math.round((Date.parse(b.expiry_date) - Date.now()) / 86400_000) : null;
              return (
                <tr key={b.id} className="border-t border-white/5">
                  <td className="p-2">{b.product_name} <span className="text-smoke">({[b.label, b.flavour].filter(Boolean).join(", ")})</span></td>
                  <td className="p-2">{b.batch_no || "—"}</td>
                  <td className={cn("p-2", daysLeft !== null && daysLeft < 0 ? "font-bold text-ember" : daysLeft !== null && daysLeft <= 60 ? "text-gold" : "")}>{fmtDay(b.expiry_date)}{daysLeft !== null && daysLeft < 0 ? " (expired)" : ""}</td>
                  <td className="p-2 text-right">{b.qty_remaining} / {b.qty_received}</td>
                  <td className="p-2 text-xs text-smoke">{b.supplier_name ?? "—"} · {b.purchase_no ?? ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const REASONS = [
  { id: "count_correction", label: "Stock count correction" },
  { id: "damaged", label: "Damaged" },
  { id: "expired", label: "Expired" },
  { id: "lost", label: "Lost / missing" },
  { id: "free_sample", label: "Free sample / gift" },
  { id: "found", label: "Found extra" },
  { id: "other", label: "Other" },
];

function AdjustDialog({ row, onClose, onDone }: { row: InventoryRow; onClose: () => void; onDone: () => void }) {
  const [dir, setDir] = useState<"remove" | "add">("remove");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("count_correction");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [txn] = useState(() => (crypto && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now())));
  const submit = async () => {
    setBusy(true);
    setErr("");
    try {
      await api("/api/admin/inventory/adjust", { method: "POST", json: { variantId: row.variant_id, change: (dir === "add" ? 1 : -1) * Number(qty), reason, note, clientTxnId: txn } });
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={`Adjust stock — ${row.name} (${row.label})`} onClose={onClose}>
      <p className="mb-3 text-sm text-smoke">Current stock: <b className="text-white">{row.stock}</b>. Use this only for corrections — sales and deliveries update stock automatically.</p>
      <div className="mb-3 grid grid-cols-2 gap-2">
        {(["remove", "add"] as const).map((d) => (
          <button key={d} onClick={() => setDir(d)} className={cn("rounded-xl border py-3 text-sm font-bold", dir === d ? (d === "add" ? "border-green-500 bg-green-500/15 text-green-300" : "border-ember bg-ember/15 text-ember") : "border-white/10 text-zinc-400")}>
            {d === "add" ? "+ Add units" : "− Remove units"}
          </button>
        ))}
      </div>
      <input value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="How many units?" className="input mb-2 text-lg" autoFocus />
      <select value={reason} onChange={(e) => setReason(e.target.value)} className="input mb-2">
        {REASONS.map((r) => <option key={r.id} value={r.id} className="bg-coal">{r.label}</option>)}
      </select>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (required for “Other”)" className="input mb-3" />
      {qty && <p className="mb-2 text-sm">New stock will be <b className="text-gold">{row.stock + (dir === "add" ? 1 : -1) * Number(qty)}</b></p>}
      {err && <Alert className="mb-2">{err}</Alert>}
      <button onClick={submit} disabled={busy || !Number(qty)} className="btn btn-red w-full">{busy && <Spinner />} Save adjustment</button>
    </Modal>
  );
}

function HistoryDialog({ row, onClose }: { row: InventoryRow; onClose: () => void }) {
  return (
    <Modal title={`${row.name} (${[row.label, row.flavour].filter(Boolean).join(", ")}) — history`} onClose={onClose} wide>
      <Movements variantId={row.variant_id} />
    </Modal>
  );
}


/** Low-stock items grouped by supplier → one prefilled WhatsApp order per supplier (free wa.me link). */
function ReorderDialog({ suppliers, onClose }: { suppliers: { id: string; name: string; phone?: string }[]; onClose: () => void }) {
  const { data, error } = useApi<{ items: InventoryRow[] }>("/api/admin/inventory?low=1");
  const [qty, setQty] = useState<Record<string, number>>({});
  const suggest = (r: InventoryRow) => qty[r.variant_id] ?? Math.max(1, r.min_stock * 2 - Math.max(0, r.stock));
  const groups = new Map<string, InventoryRow[]>();
  for (const r of data?.items ?? []) {
    const k = r.supplier_id ?? "";
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const message = (sup: string, rows: InventoryRow[]) =>
    [
      `Hi ${sup || ""}, this is PowerX Nutrition (Veppampattu). Please send the following:`,
      "",
      ...rows.map((r, i) => `${i + 1}. ${r.brand} ${r.name} – ${[r.label, r.flavour].filter(Boolean).join(", ")}${r.sku ? ` (${r.sku})` : ""} × ${suggest(r)}`),
      "",
      "Please confirm availability, rates and delivery date. Thank you!",
    ].join("\n");
  return (
    <Modal title="Reorder low stock on WhatsApp" onClose={onClose} wide>
      {error && <Alert>{error}</Alert>}
      {!data && <p className="p-4 text-center"><Spinner /></p>}
      {data && !data.items.length && <Empty>Nothing is low on stock 🎉</Empty>}
      <div className="space-y-4">
        {[...groups.entries()].map(([sid, rows]) => {
          const sup = suppliers.find((s) => s.id === sid);
          const phone = (sup?.phone ?? "").replace(/\D/g, "").slice(-10);
          const text = message(sup?.name ?? "", rows);
          return (
            <div key={sid || "none"} className="rounded-2xl border border-white/10 p-3">
              <p className="mb-2 font-semibold">{sup?.name ?? "No supplier set"} {phone && <span className="text-xs text-smoke">· {phone}</span>}</p>
              <ul className="mb-3 space-y-1 text-sm">
                {rows.map((r) => (
                  <li key={r.variant_id} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate">{r.name} <span className="text-smoke">({[r.label, r.flavour].filter(Boolean).join(", ")}) · stock {r.stock}</span></span>
                    <input type="number" min={1} value={suggest(r)} onChange={(e) => setQty({ ...qty, [r.variant_id]: Math.max(1, Number(e.target.value) || 1) })} className="input w-20! py-1!" aria-label="Quantity to order" />
                  </li>
                ))}
              </ul>
              <a href={`https://wa.me/${phone.length === 10 ? `91${phone}` : ""}?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener" className="btn btn-whatsapp w-full py-2.5! text-xs!">
                📲 {phone.length === 10 ? `Send order to ${sup?.name}` : "Open WhatsApp (choose the supplier chat)"}
              </a>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-smoke">Set each product's main supplier (Products → Edit) and the supplier's phone (Suppliers) to send straight to the right chat. When the goods arrive, use Receive stock.</p>
    </Modal>
  );
}
