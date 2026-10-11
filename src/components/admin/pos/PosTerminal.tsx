"use client";

import Image from "@/components/ui/Img";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { UpiQr } from "@/components/order/UpiQr";
import { cn } from "@/lib/format";
import { inr2, toPaise, toRupees } from "@/lib/money";
import { computeBill, type Bill } from "@/lib/tax";
import type { SaleView } from "@/lib/server/sales";
import { CloseIcon, MinusIcon, PlusIcon, SearchIcon, TrashIcon } from "../../ui/Icons";
import { Receipt, receiptWhatsAppText } from "../Receipt";
import { WhatsAppBill } from "../WhatsAppBill";
import { Alert, api, type ApiError, Spinner, useOnline } from "../ui";

type Method = "cash" | "upi" | "card" | "other";

interface PosConfig {
  methods: Method[];
  maxDiscountPct: number;
  tax: { registered: boolean; inclusive: boolean; roundToRupee: boolean };
  allowNegative: boolean;
  upi: { id: string; name: string };
  shopName: string;
  whatsappAuto: boolean;
}

interface CatalogItem {
  variant_id: string;
  slug: string;
  name: string;
  brand: string;
  label: string;
  flavour: string;
  sku: string | null;
  barcode: string | null;
  price: number;
  mrp: number;
  stock: number;
  image: string;
  status: string;
  gst_rate: number | null;
}

interface CartLine {
  variantId: string;
  name: string;
  label: string;
  price: number;
  qty: number;
  stock: number;
  image: string;
  gstRate: number | null;
}

interface Draft {
  txnId: string;
  cart: CartLine[];
  discount: { type: "amount" | "percent"; value: string };
  customer: { name: string; phone: string };
  startedAt: string;
}

interface QueuedBill {
  payload: Record<string, unknown>;
  savedAt: string;
  total: number;
  status: "pending" | "conflict";
  error?: string;
}

const CATALOG_KEY = "px_pos_catalog_v1";
const DRAFT_KEY = "px_pos_draft_v1";
const QUEUE_KEY = "px_pos_queue_v1";
const METHOD_LABEL: Record<Method, string> = { cash: "Cash", upi: "UPI", card: "Card", other: "Other" };

const uid = () => (crypto && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`);
const freshDraft = (): Draft => ({ txnId: uid(), cart: [], discount: { type: "amount", value: "" }, customer: { name: "", phone: "" }, startedAt: new Date().toISOString() });
const load = <T,>(k: string, d: T): T => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : d;
  } catch {
    return d;
  }
};
const save = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};

export function PosTerminal({ config }: { config: PosConfig }) {
  const online = useOnline();
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [catalogAt, setCatalogAt] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState<Draft>(freshDraft);
  const [ready, setReady] = useState(false);
  const [method, setMethod] = useState<Method>(config.methods[0] ?? "cash");
  const [split, setSplit] = useState(false);
  const [splitRows, setSplitRows] = useState<{ method: Method; amount: string; reference: string }[]>([]);
  const [tendered, setTendered] = useState("");
  const [reference, setReference] = useState("");
  const [showUpiQr, setShowUpiQr] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [offlineOffer, setOfflineOffer] = useState(false);
  const [done, setDone] = useState<{ sale: SaleView; receiptUrl: string; pdfUrl: string; duplicate: boolean } | null>(null);
  const [queue, setQueue] = useState<QueuedBill[]>([]);
  const [syncMsg, setSyncMsg] = useState("");
  const [scanning, setScanning] = useState(false);
  const [mobileTab, setMobileTab] = useState<"items" | "bill">("items");
  const searchRef = useRef<HTMLInputElement>(null);

  // ---- boot: restore draft/queue, load catalogue (cached copy first so it works offline)
  const refreshCatalog = useCallback(async () => {
    try {
      const d = await api<{ results: CatalogItem[]; cachedAt: string }>("/api/admin/variants?all=1");
      setCatalog(d.results);
      setCatalogAt(d.cachedAt);
      save(CATALOG_KEY, { results: d.results, cachedAt: d.cachedAt });
    } catch {
      /* keep cached copy */
    }
  }, []);

  useEffect(() => {
    const cached = load<{ results: CatalogItem[]; cachedAt: string } | null>(CATALOG_KEY, null);
    if (cached) {
      setCatalog(cached.results);
      setCatalogAt(cached.cachedAt);
    }
    setDraft(load<Draft>(DRAFT_KEY, freshDraft()));
    setQueue(load<QueuedBill[]>(QUEUE_KEY, []));
    setReady(true);
    refreshCatalog();
    const t = setInterval(refreshCatalog, 120_000);
    return () => clearInterval(t);
  }, [refreshCatalog]);

  useEffect(() => {
    if (ready) save(DRAFT_KEY, draft);
  }, [draft, ready]);
  useEffect(() => {
    if (ready) save(QUEUE_KEY, queue);
  }, [queue, ready]);

  // ---- search
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return catalog.filter((c) => c.status === "published").slice(0, 24);
    const words = s.split(/\s+/);
    const exact = catalog.filter((c) => (c.sku ?? "").toLowerCase() === s || (c.barcode ?? "") === q.trim());
    if (exact.length) return exact;
    return catalog
      .filter((c) => {
        const hay = `${c.brand} ${c.name} ${c.label} ${c.flavour} ${c.sku ?? ""} ${c.barcode ?? ""}`.toLowerCase();
        return words.every((w) => hay.includes(w));
      })
      .sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0))
      .slice(0, 40);
  }, [q, catalog]);

  const add = (c: CatalogItem) => {
    setError("");
    setDraft((d) => {
      const ex = d.cart.find((l) => l.variantId === c.variant_id);
      const cart = ex
        ? d.cart.map((l) => (l.variantId === c.variant_id ? { ...l, qty: l.qty + 1, stock: c.stock, price: c.price } : l))
        : [...d.cart, { variantId: c.variant_id, name: `${c.brand && !c.name.toLowerCase().startsWith(c.brand.toLowerCase()) ? `${c.brand} ` : ""}${c.name}`, label: [c.label, c.flavour].filter(Boolean).join(" · "), price: c.price, qty: 1, stock: c.stock, image: c.image, gstRate: c.gst_rate }];
      return { ...d, cart };
    });
  };

  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    // barcode scanners type the code + Enter
    const code = q.trim();
    const hit = catalog.find((c) => (c.barcode ?? "") === code || (c.sku ?? "").toLowerCase() === code.toLowerCase()) ?? (results.length === 1 ? results[0] : undefined);
    if (hit) {
      add(hit);
      setQ("");
    }
  };

  const setQty = (id: string, qty: number) =>
    setDraft((d) => ({ ...d, cart: qty <= 0 ? d.cart.filter((l) => l.variantId !== id) : d.cart.map((l) => (l.variantId === id ? { ...l, qty: Math.min(1000, Math.floor(qty)) } : l)) }));

  // ---- bill preview (the server recalculates everything; this is only what the cashier sees)
  const subtotalPaise = draft.cart.reduce((s, l) => s + toPaise(l.price) * l.qty, 0);
  const discVal = Number(draft.discount.value) || 0;
  const discountPaise = draft.discount.type === "percent" ? Math.round((subtotalPaise * Math.min(discVal, 100)) / 100) : toPaise(discVal);
  const discountPct = subtotalPaise ? (discountPaise / subtotalPaise) * 100 : 0;
  const discountTooHigh = discountPct > config.maxDiscountPct + 1e-9;
  let bill: Bill | null = null;
  let billError = "";
  try {
    if (draft.cart.length)
      bill = computeBill(
        draft.cart.map((l) => ({ key: l.variantId, name: `${l.name} (${l.label})`, qty: l.qty, unitPrice: toPaise(l.price), gstRate: l.gstRate })),
        Math.min(discountPaise, subtotalPaise),
        { registered: config.tax.registered, inclusive: config.tax.inclusive, interState: false, roundToRupee: config.tax.roundToRupee },
      );
  } catch (e) {
    billError = (e as Error).message;
  }
  const total = bill ? toRupees(bill.total) : 0;
  const stockIssues = draft.cart.filter((l) => l.qty > l.stock && !config.allowNegative);
  const change = method === "cash" && !split && Number(tendered) > total ? Math.round((Number(tendered) - total) * 100) / 100 : 0;

  const paymentsPayload = () => {
    if (!split) return [{ method, amount: total, reference: reference.trim(), tendered: method === "cash" && Number(tendered) > 0 ? Number(tendered) : undefined }];
    return splitRows.filter((r) => Number(r.amount) > 0).map((r) => ({ method: r.method, amount: Number(r.amount), reference: r.reference.trim() }));
  };
  const splitSum = splitRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const splitOk = !split || Math.abs(splitSum - total) < 0.005;

  const canSubmit = Boolean(bill) && !billError && !discountTooHigh && !stockIssues.length && splitOk && !submitting && (method !== "cash" || split || !tendered || Number(tendered) >= total);

  const payload = () => ({
    clientTxnId: draft.txnId,
    items: draft.cart.map((l) => ({ variantId: l.variantId, qty: l.qty })),
    discount: discountPaise > 0 ? { type: draft.discount.type, value: discVal } : null,
    payments: paymentsPayload(),
    customer: { name: draft.customer.name.trim(), phone: draft.customer.phone.trim() },
    expectedTotal: total,
  });

  const resetBill = () => {
    setDraft(freshDraft());
    setTendered("");
    setReference("");
    setSplit(false);
    setSplitRows([]);
    setShowUpiQr(false);
    setError("");
    setOfflineOffer(false);
    setMobileTab("items");
    setTimeout(() => searchRef.current?.focus(), 50);
  };

  const complete = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    setOfflineOffer(false);
    try {
      const d = await api<{ sale: SaleView; receiptUrl: string; pdfUrl: string; duplicate: boolean }>("/api/admin/sales", { method: "POST", json: payload() });
      setDone(d);
      resetBill();
      refreshCatalog();
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 0) {
        setError(err.message);
        setOfflineOffer(true);
      } else if (err.data?.code === "PRICE_CHANGED") {
        setError(`${err.message} The prices on screen have been refreshed.`);
        await refreshCatalog();
      } else setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  /** Explicit, clearly-labelled offline save. The same transaction id guarantees no duplicate later. */
  const saveOffline = () => {
    const p = { ...payload(), offlineCreatedAt: new Date().toISOString() };
    setQueue((qq) => [...qq, { payload: p, savedAt: new Date().toISOString(), total, status: "pending" }]);
    resetBill();
    setSyncMsg("Bill saved on this device as PENDING — it is NOT in the system yet. It will be sent automatically when the internet is back.");
  };

  const syncing = useRef(false);
  const syncQueue = useCallback(async () => {
    if (syncing.current) return;
    const items = load<QueuedBill[]>(QUEUE_KEY, []);
    if (!items.length) return;
    syncing.current = true;
    const next: QueuedBill[] = [];
    let synced = 0;
    let offline = false;
    for (const item of items) {
      if (offline || item.status === "conflict") {
        next.push(item);
        continue;
      }
      try {
        // same clientTxnId as when it was saved → the server can never create it twice
        await api("/api/admin/sales", { method: "POST", json: item.payload });
        synced++;
      } catch (e) {
        const err = e as ApiError;
        if (err.status === 0) {
          offline = true;
          next.push(item);
        } else {
          // stock/prices changed meanwhile → a person must decide; never auto-adjusted
          next.push({ ...item, status: "conflict", error: err.message });
        }
      }
    }
    setQueue(next);
    save(QUEUE_KEY, next);
    syncing.current = false;
    if (synced) {
      setSyncMsg(`${synced} offline bill(s) synced ✔ — stock updated.`);
      refreshCatalog();
    }
  }, [refreshCatalog]);

  useEffect(() => {
    if (!ready) return;
    if (online) syncQueue();
    const t = setInterval(() => navigator.onLine && syncQueue(), 30_000);
    return () => clearInterval(t);
  }, [online, ready, syncQueue]);

  const retryConflict = (i: number) => {
    if (/price/i.test(queue[i]?.error ?? "")) {
      window.alert("Prices changed since this offline bill was made, so it can't be saved as it is. Discard it and make the bill again (the system never changes amounts on its own).");
      return;
    }
    // e.g. stock was received since → try again
    setQueue((qq) => qq.map((x, idx) => (idx === i ? { ...x, status: "pending", error: undefined } : x)));
  };
  const dropQueued = (i: number) => {
    if (!window.confirm("Discard this offline bill? It was never saved in the system, so no stock will change. Make sure the customer's money is handled.")) return;
    setQueue((qq) => qq.filter((_, idx) => idx !== i));
  };

  // ---- completed bill view
  if (done) {
    const s = done.sale;
    const text = receiptWhatsAppText(s, done.pdfUrl);
    return (
      <div className="mx-auto max-w-lg">
        <div className="mb-4 rounded-2xl border border-green-500/30 bg-green-500/10 p-4 text-center print:hidden">
          <p className="font-display text-3xl text-green-300">Bill saved ✔</p>
          <p className="text-sm text-zinc-300">
            {s.bill_no} · {inr2(s.total)} · stock updated{done.duplicate ? " (this bill was already saved — no duplicate created)" : ""}
          </p>
        </div>
        <div className="mb-4 print:hidden">
          <WhatsAppBill sale={s} pdfUrl={done.pdfUrl} auto={config.whatsappAuto} />
        </div>
        <Receipt sale={s} />
        <div className="mt-4 grid grid-cols-2 gap-2 print:hidden">
          <button onClick={() => window.print()} className="btn btn-ghost py-3!">🖨 Print</button>
          <button
            onClick={async () => {
              // phones: share the actual PDF file (WhatsApp, Gmail, …); otherwise copy the link
              try {
                const blob = await (await fetch(done.pdfUrl)).blob();
                const file = new File([blob], `${s.bill_no.replace(/[^\w-]+/g, "-")}.pdf`, { type: "application/pdf" });
                if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: `Bill ${s.bill_no}`, text });
                else if (navigator.share) await navigator.share({ title: `Bill ${s.bill_no}`, text, url: done.pdfUrl });
                else {
                  await navigator.clipboard.writeText(done.pdfUrl);
                  setSyncMsg("PDF link copied");
                }
              } catch {}
            }}
            className="btn btn-ghost py-3!"
          >
            Share PDF
          </button>
          <button onClick={() => setDone(null)} className="btn btn-red col-span-2 py-3!">+ New bill</button>
        </div>
      </div>
    );
  }

  const billPanel = (
    <div className="space-y-4">
      {draft.cart.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-smoke">Tap products to add them to the bill, or scan a barcode.</p>
      ) : (
        <ul className="divide-y divide-white/5 rounded-2xl border border-white/8 bg-coal">
          {draft.cart.map((l) => (
            <li key={l.variantId} className="flex items-center gap-2 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{l.name}</p>
                <p className="text-xs text-smoke">
                  {l.label} · {inr2(l.price)}
                  {l.qty > l.stock && <b className={cn("ml-1", config.allowNegative ? "text-gold" : "text-ember")}>only {Math.max(0, l.stock)} in stock</b>}
                </p>
              </div>
              <div className="flex items-center rounded-xl border border-white/10">
                <button onClick={() => setQty(l.variantId, l.qty - 1)} className="flex h-11 w-11 items-center justify-center" aria-label="Less"><MinusIcon size={16} /></button>
                <input
                  value={l.qty}
                  onChange={(e) => setQty(l.variantId, Number(e.target.value.replace(/\D/g, "")) || 0)}
                  inputMode="numeric"
                  className="w-10 bg-transparent text-center font-bold outline-none"
                  aria-label="Quantity"
                />
                <button onClick={() => setQty(l.variantId, l.qty + 1)} className="flex h-11 w-11 items-center justify-center" aria-label="More"><PlusIcon size={16} /></button>
              </div>
              <span className="w-20 text-right text-sm font-bold">{inr2(l.price * l.qty)}</span>
              <button onClick={() => setQty(l.variantId, 0)} className="p-2 text-smoke hover:text-ember" aria-label="Remove"><TrashIcon size={16} /></button>
            </li>
          ))}
        </ul>
      )}

      {draft.cart.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={draft.customer.phone}
              onChange={(e) => setDraft((d) => ({ ...d, customer: { ...d.customer, phone: e.target.value } }))}
              inputMode="tel"
              placeholder="Customer mobile (optional)"
              className="input py-2.5!"
              maxLength={14}
            />
            <input value={draft.customer.name} onChange={(e) => setDraft((d) => ({ ...d, customer: { ...d.customer, name: e.target.value } }))} placeholder="Customer name (optional)" className="input py-2.5!" />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Discount</span>
            <div className="flex overflow-hidden rounded-xl border border-white/10">
              {(["amount", "percent"] as const).map((t) => (
                <button key={t} onClick={() => setDraft((d) => ({ ...d, discount: { ...d.discount, type: t } }))} className={cn("px-3 py-2 text-sm font-bold", draft.discount.type === t ? "bg-gold text-black" : "text-zinc-400")}>
                  {t === "amount" ? "₹" : "%"}
                </button>
              ))}
            </div>
            <input
              value={draft.discount.value}
              onChange={(e) => setDraft((d) => ({ ...d, discount: { ...d.discount, value: e.target.value.replace(/[^\d.]/g, "") } }))}
              inputMode="decimal"
              placeholder="0"
              className="input w-24! py-2!"
            />
            <span className="text-[0.7rem] text-smoke">max {config.maxDiscountPct}%</span>
          </div>
          {discountTooHigh && <Alert>Discount is {discountPct.toFixed(1)}% — your limit is {config.maxDiscountPct}%. Ask a manager/owner.</Alert>}

          <dl className="space-y-1 rounded-2xl border border-white/8 bg-coal p-4 text-sm">
            <div className="flex justify-between text-zinc-300"><dt>Subtotal</dt><dd>{inr2(toRupees(subtotalPaise))}</dd></div>
            {bill && bill.discount > 0 && <div className="flex justify-between text-green-400"><dt>Discount</dt><dd>− {inr2(toRupees(bill.discount))}</dd></div>}
            {bill && config.tax.registered && (
              <div className="flex justify-between text-zinc-400"><dt>GST {config.tax.inclusive ? "(included)" : ""}</dt><dd>{inr2(toRupees(bill.tax))}</dd></div>
            )}
            {bill && bill.roundOff !== 0 && <div className="flex justify-between text-zinc-500"><dt>Round off</dt><dd>{inr2(toRupees(bill.roundOff))}</dd></div>}
            <div className="flex justify-between pt-1 text-2xl font-extrabold"><dt>Total</dt><dd className="text-gold">{inr2(total)}</dd></div>
          </dl>
          {billError && <Alert>{billError}</Alert>}

          <div>
            <div className="flex flex-wrap gap-2">
              {config.methods.map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setMethod(m);
                    setSplit(false);
                  }}
                  className={cn("min-w-20 flex-1 rounded-xl border px-3 py-3 text-sm font-bold", !split && method === m ? "border-gold bg-gold/15 text-gold" : "border-white/10 text-zinc-300")}
                >
                  {METHOD_LABEL[m]}
                </button>
              ))}
              {config.methods.length > 1 && (
                <button
                  onClick={() => {
                    setSplit(true);
                    setSplitRows([
                      { method: config.methods[0], amount: "", reference: "" },
                      { method: config.methods[1], amount: "", reference: "" },
                    ]);
                  }}
                  className={cn("rounded-xl border px-3 py-3 text-sm font-bold", split ? "border-gold bg-gold/15 text-gold" : "border-white/10 text-zinc-300")}
                >
                  Split
                </button>
              )}
            </div>
            {!split && method === "cash" && (
              <div className="mt-3 flex items-center gap-2">
                <input value={tendered} onChange={(e) => setTendered(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="Cash received (optional)" className="input py-2.5!" />
                {change > 0 && <span className="shrink-0 rounded-xl bg-green-500/15 px-3 py-2 text-sm font-bold text-green-300">Return {inr2(change)}</span>}
              </div>
            )}
            {!split && (method === "upi" || method === "card" || method === "other") && (
              <div className="mt-3 space-y-2">
                <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={method === "upi" ? "UPI ref / UTR (optional)" : "Reference (optional)"} className="input py-2.5!" maxLength={40} />
                {method === "upi" && (
                  <>
                    <button onClick={() => setShowUpiQr((v) => !v)} className="btn btn-ghost w-full py-2.5! text-xs!">{showUpiQr ? "Hide" : "Show"} UPI QR for {inr2(total)}</button>
                    {showUpiQr && total > 0 && <UpiQr amount={total} orderId={draft.txnId.slice(0, 8).toUpperCase()} />}
                    <p className="text-[0.7rem] text-smoke">Check the money has arrived in your UPI app before completing. This is recorded as “received by cashier”, not gateway-verified.</p>
                  </>
                )}
              </div>
            )}
            {split && (
              <div className="mt-3 space-y-2">
                {splitRows.map((r, i) => (
                  <div key={i} className="grid grid-cols-[6rem_1fr_1fr] gap-2">
                    <select value={r.method} onChange={(e) => setSplitRows((rows) => rows.map((x, idx) => (idx === i ? { ...x, method: e.target.value as Method } : x)))} className="input py-2!">
                      {config.methods.map((m) => <option key={m} value={m} className="bg-coal">{METHOD_LABEL[m]}</option>)}
                    </select>
                    <input value={r.amount} onChange={(e) => setSplitRows((rows) => rows.map((x, idx) => (idx === i ? { ...x, amount: e.target.value.replace(/[^\d.]/g, "") } : x)))} inputMode="decimal" placeholder="Amount" className="input py-2!" />
                    <input value={r.reference} onChange={(e) => setSplitRows((rows) => rows.map((x, idx) => (idx === i ? { ...x, reference: e.target.value } : x)))} placeholder="Ref" className="input py-2!" />
                  </div>
                ))}
                <p className={cn("text-xs", splitOk ? "text-green-400" : "text-gold")}>
                  {inr2(splitSum)} of {inr2(total)} {splitOk ? "✔" : `— ${inr2(Math.round((total - splitSum) * 100) / 100)} left`}
                </p>
              </div>
            )}
          </div>

          {stockIssues.length > 0 && <Alert>Not enough stock for {stockIssues.map((l) => l.name).join(", ")}. Reduce the quantity or receive stock first.</Alert>}
          {error && <Alert>{error}</Alert>}
          {offlineOffer && (
            <div className="rounded-xl border border-gold/40 bg-gold/10 p-3 text-sm text-gold">
              <p>The bill was <b>not saved</b> because there is no connection.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button onClick={complete} className="btn btn-ghost py-2! text-xs!">Try again</button>
                <button onClick={saveOffline} className="btn btn-gold py-2! text-xs!">Save on this device (pending sync)</button>
              </div>
            </div>
          )}
          <button onClick={complete} disabled={!canSubmit} className="btn btn-red w-full py-4! text-base!">
            {submitting ? <Spinner /> : null} {submitting ? "Saving bill…" : `Complete sale · ${inr2(total)}`}
          </button>
          <button onClick={() => window.confirm("Clear this bill?") && resetBill()} className="w-full text-center text-xs font-bold uppercase tracking-widest text-smoke hover:text-ember">
            Clear bill
          </button>
        </>
      )}
    </div>
  );

  return (
    <div className="pb-24 lg:pb-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-3xl">New bill</h1>
          <p className="text-xs text-smoke">
            {online ? <span className="text-green-400">● Online</span> : <span className="text-ember">● Offline</span>} · stock as of {catalogAt ? new Date(catalogAt).toLocaleTimeString("en-IN") : "—"} (checked again when you complete)
          </p>
        </div>
        <Link href="/admin/sales" className="btn btn-ghost px-3! py-2! text-xs!">Bills & returns</Link>
      </div>

      {syncMsg && (
        <Alert tone={syncMsg.includes("NOT") ? "warn" : "ok"} className="mb-3">
          {syncMsg} <button onClick={() => setSyncMsg("")} className="ml-2 underline">OK</button>
        </Alert>
      )}
      {queue.length > 0 && (
        <div className="mb-4 rounded-2xl border border-gold/40 bg-gold/10 p-3 text-sm">
          <p className="font-bold text-gold">{queue.length} bill(s) saved on this device, waiting to sync — not in the system yet</p>
          <ul className="mt-2 space-y-1">
            {queue.map((b, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span>{new Date(b.savedAt).toLocaleString("en-IN")} · {inr2(b.total)} · {b.status === "conflict" ? <b className="text-ember">Needs attention: {b.error}</b> : "pending"}</span>
                <span className="flex gap-2">
                  {b.status === "conflict" && <button onClick={() => retryConflict(i)} className="underline">Retry</button>}
                  <button onClick={() => dropQueued(i)} className="text-ember underline">Discard</button>
                </span>
              </li>
            ))}
          </ul>
          {online && <button onClick={syncQueue} className="mt-2 text-xs font-bold underline">Sync now</button>}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_24rem]">
        <div className={cn(mobileTab === "bill" && "hidden lg:block")}>
          <div className="sticky top-[57px] z-10 -mx-3 mb-3 bg-[#0b0b0d] px-3 py-2 lg:static lg:mx-0 lg:p-0">
            <div className="flex gap-2">
              <label className="relative flex-1">
                <SearchIcon size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-smoke" />
                <input
                  ref={searchRef}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={onSearchKey}
                  placeholder="Search name, brand, SKU or scan barcode…"
                  className="input py-3.5! pl-11 text-base"
                  autoFocus
                  enterKeyHint="search"
                />
                {q && <button onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-smoke" aria-label="Clear"><CloseIcon size={18} /></button>}
              </label>
              <button onClick={() => setScanning(true)} className="btn btn-ghost px-4!" aria-label="Scan barcode with camera">📷</button>
            </div>
          </div>
          {!catalog.length && <p className="p-6 text-center text-sm text-smoke">{online ? "Loading products…" : "No product list on this device yet — connect to the internet once."}</p>}
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {results.map((c) => {
              const inCart = draft.cart.find((l) => l.variantId === c.variant_id)?.qty ?? 0;
              const out = c.stock <= 0;
              return (
                <li key={c.variant_id}>
                  <button
                    onClick={() => add(c)}
                    disabled={out && !config.allowNegative}
                    className={cn("relative flex h-full w-full flex-col rounded-2xl border bg-coal p-2.5 text-left transition active:scale-[0.98]", inCart ? "border-gold" : "border-white/8 hover:border-white/25", out && "opacity-50")}
                  >
                    <div className="relative mb-2 aspect-square w-full overflow-hidden rounded-xl bg-gradient-to-b from-snow to-zinc-200">
                      {c.image ? <Image src={c.image} alt="" fill sizes="160px" className="object-contain p-1.5 mix-blend-multiply" /> : <span className="flex h-full items-center justify-center p-2 text-center text-[0.6rem] font-bold uppercase text-zinc-500">{c.brand}</span>}
                      {inCart > 0 && <span className="absolute right-1 top-1 rounded-full bg-gold px-2 text-xs font-extrabold text-black">{inCart}</span>}
                    </div>
                    <span className="line-clamp-2 text-xs font-semibold leading-tight">{c.name}</span>
                    <span className="mt-0.5 text-[0.7rem] text-smoke">{[c.label, c.flavour].filter(Boolean).join(" · ")}</span>
                    <span className="mt-auto flex items-end justify-between pt-1">
                      <b className="text-sm text-gold">{inr2(c.price)}</b>
                      <span className={cn("text-[0.65rem] font-bold", out ? "text-ember" : c.stock <= 2 ? "text-gold" : "text-green-400")}>{out ? "Out" : `${c.stock} left`}</span>
                    </span>
                    {c.status !== "published" && <span className="absolute left-3 top-3 rounded bg-zinc-700 px-1 text-[0.55rem] font-bold uppercase">Not online</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className={cn("lg:sticky lg:top-6 lg:self-start", mobileTab === "items" && "hidden lg:block")}>{billPanel}</div>
      </div>

      {/* phone: bottom bar switches between product grid and bill */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-coal/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="flex items-center gap-2 px-3 py-2">
          <button onClick={() => setMobileTab("items")} className={cn("flex-1 rounded-xl py-3 text-sm font-bold", mobileTab === "items" ? "bg-white/10" : "text-zinc-400")}>Products</button>
          <button onClick={() => setMobileTab("bill")} className={cn("flex-[1.4] rounded-xl py-3 text-sm font-bold", mobileTab === "bill" ? "bg-blood text-white" : "bg-blood/30 text-white")}>
            Bill · {draft.cart.reduce((s, l) => s + l.qty, 0)} item(s) · {inr2(total)}
          </button>
        </div>
      </div>

      {scanning && <BarcodeScanner onClose={() => setScanning(false)} onCode={(code) => {
        const hit = catalog.find((c) => (c.barcode ?? "") === code || (c.sku ?? "").toUpperCase() === code.toUpperCase());
        if (hit) {
          add(hit);
          setSyncMsg(`Added ${hit.name} (${hit.label})`);
        } else setQ(code);
        setScanning(false);
      }} />}
    </div>
  );
}

/** Camera barcode scanning with the browser's built-in BarcodeDetector (free; Chrome/Android). */
function BarcodeScanner({ onClose, onCode }: { onClose: () => void; onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [msg, setMsg] = useState("Point the camera at the barcode…");
  useEffect(() => {
    let stream: MediaStream | null = null;
    let stop = false;
    type Detector = { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
    const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
    if (!BD) {
      setMsg("This browser can't scan barcodes with the camera. Use Chrome on Android, a USB/Bluetooth scanner, or type the code.");
      return;
    }
    const detector = new BD({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"] });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        while (!stop) {
          const codes = await detector.detect(video.current).catch(() => []);
          if (codes[0]?.rawValue) {
            onCode(codes[0].rawValue.trim());
            return;
          }
          await new Promise((r) => setTimeout(r, 250));
        }
      } catch {
        setMsg("Camera permission denied or camera not available (needs https).");
      }
    })();
    return () => {
      stop = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onCode]);
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4">
      <video ref={video} className="w-full max-w-md rounded-2xl" playsInline muted />
      <p className="mt-3 text-center text-sm text-zinc-300">{msg}</p>
      <button onClick={onClose} className="btn btn-ghost mt-4">Close</button>
    </div>
  );
}
