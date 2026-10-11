"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/format";

/**
 * Small shared kit for the admin panel: big touch-friendly controls, clear success/error messages,
 * loading & empty states. Everything works on a phone first.
 */

export function PageHeader({ title, subtitle, actions, back }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-1 inline-block text-xs font-bold uppercase tracking-widest text-smoke hover:text-white">
            ← {back.label}
          </Link>
        )}
        <h1 className="font-display text-3xl sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-smoke">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className, title, action }: { children: React.ReactNode; className?: string; title?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className={cn("rounded-2xl border border-white/8 bg-coal p-4 sm:p-5", className)}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="font-display text-xl sm:text-2xl">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, tone = "text-white", href }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: string; href?: string }) {
  const body = (
    <>
      <p className="text-[0.65rem] font-bold uppercase tracking-widest text-smoke">{label}</p>
      <p className={cn("font-display mt-1.5 text-2xl sm:text-3xl", tone)}>{value}</p>
      {hint && <p className="mt-1 text-xs text-smoke">{hint}</p>}
    </>
  );
  return href ? (
    <Link href={href} className="block rounded-2xl border border-white/8 bg-coal p-4 transition hover:border-gold/40">{body}</Link>
  ) : (
    <div className="rounded-2xl border border-white/8 bg-coal p-4">{body}</div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-smoke">{children}</p>;
}

export function Alert({ tone = "error", children, className }: { tone?: "error" | "ok" | "warn" | "info"; children: React.ReactNode; className?: string }) {
  const tones = {
    error: "border-ember/40 bg-ember/10 text-ember",
    ok: "border-green-500/30 bg-green-500/10 text-green-300",
    warn: "border-gold/40 bg-gold/10 text-gold",
    info: "border-white/10 bg-white/5 text-zinc-300",
  };
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("rounded-xl border p-3 text-sm", tones[tone], className)}>
      {children}
    </div>
  );
}

export function Badge({ children, tone = "zinc" }: { children: React.ReactNode; tone?: "zinc" | "green" | "gold" | "red" | "blue" | "purple" }) {
  const tones = {
    zinc: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
    green: "bg-green-500/15 text-green-300 border-green-500/30",
    gold: "bg-gold/15 text-gold border-gold/40",
    red: "bg-red-500/15 text-red-300 border-red-500/30",
    blue: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    purple: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  };
  return <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wider whitespace-nowrap", tones[tone])}>{children}</span>;
}

export const labelCls = "mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-400";

export function Field({ label, hint, error, children, className }: { label: string; hint?: React.ReactNode; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className={labelCls}>{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-[0.7rem] text-smoke">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-ember">{error}</span>}
    </label>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cn("inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white", className)} aria-hidden />;
}

export interface ApiError extends Error {
  status: number;
  data: Record<string, unknown>;
}

/** fetch → JSON with readable errors (and an offline-friendly message). */
export async function api<T = Record<string, unknown>>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: json !== undefined ? { "Content-Type": "application/json", ...(rest.headers ?? {}) } : rest.headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
      cache: "no-store",
    });
  } catch {
    const e = new Error("No internet connection — nothing was saved. Check the connection and try again.") as ApiError;
    e.status = 0;
    e.data = {};
    throw e;
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") window.location.href = "/admin/login";
    const e = new Error(String(data.error ?? `Request failed (${res.status})`)) as ApiError;
    e.status = res.status;
    e.data = data;
    throw e;
  }
  return data as T;
}

/** Loads JSON and optionally re-polls (for live dashboards). */
export function useApi<T>(url: string | null, opts: { pollMs?: number } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(url));
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const urlRef = useRef(url);
  urlRef.current = url;

  const reload = useCallback(async () => {
    if (!urlRef.current) return;
    setLoading(true);
    try {
      const d = await api<T>(urlRef.current);
      setData(d);
      setError("");
      setUpdatedAt(new Date());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!url) return;
    reload();
    if (!opts.pollMs) return;
    const t = setInterval(() => {
      if (!document.hidden) reload();
    }, opts.pollMs);
    const onFocus = () => reload();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [url, opts.pollMs, reload]);

  return { data, error, loading, reload, setData, updatedAt };
}

/** "Updated 12:01:33 · live" indicator — honest about freshness. */
export function Freshness({ at, error, onRefresh }: { at: Date | null; error?: string; onRefresh?: () => void }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-smoke">
      <span className={cn("h-2 w-2 rounded-full", error ? "bg-ember" : "bg-green-400 animate-pulse")} />
      {error ? "Offline — showing last loaded data" : at ? `Updated ${at.toLocaleTimeString("en-IN")}` : "Loading…"}
      {onRefresh && (
        <button onClick={onRefresh} className="font-bold text-gold hover:underline">Refresh</button>
      )}
    </span>
  );
}

export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export const istToday = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
export const istDaysAgo = (n: number) => new Date(Date.now() + 330 * 60_000 - n * 86400_000).toISOString().slice(0, 10);

/** Date-range + channel filter bar used on dashboard and reports. */
export function PeriodFilter({ from, to, channel, onChange, showChannel = true }: { from: string; to: string; channel: string; onChange: (p: { from: string; to: string; channel: string }) => void; showChannel?: boolean }) {
  const presets = [
    { label: "Today", from: istToday(), to: istToday() },
    { label: "Yesterday", from: istDaysAgo(1), to: istDaysAgo(1) },
    { label: "7 days", from: istDaysAgo(6), to: istToday() },
    { label: "30 days", from: istDaysAgo(29), to: istToday() },
    { label: "This month", from: istToday().slice(0, 8) + "01", to: istToday() },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
        {presets.map((p) => (
          <button
            key={p.label}
            onClick={() => onChange({ from: p.from, to: p.to, channel })}
            className={cn("shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold", from === p.from && to === p.to ? "border-transparent bg-blood text-white" : "border-white/10 text-zinc-400 hover:text-white")}
          >
            {p.label}
          </button>
        ))}
      </div>
      <input type="date" value={from} max={to} onChange={(e) => onChange({ from: e.target.value, to, channel })} className="input w-auto! py-1.5! text-xs" aria-label="From date" />
      <input type="date" value={to} min={from} onChange={(e) => onChange({ from, to: e.target.value, channel })} className="input w-auto! py-1.5! text-xs" aria-label="To date" />
      {showChannel && (
        <select value={channel} onChange={(e) => onChange({ from, to, channel: e.target.value })} className="input w-auto! py-1.5! text-xs" aria-label="Sales channel">
          <option value="" className="bg-coal">Online + Shop</option>
          <option value="ONLINE" className="bg-coal">Online only</option>
          <option value="OFFLINE" className="bg-coal">Shop (POS) only</option>
        </select>
      )}
    </div>
  );
}

/** Bottom sheet on phones, centred dialog on larger screens. */
export function Modal({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn("max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-white/10 bg-coal p-5 sm:rounded-3xl", wide ? "sm:max-w-3xl" : "sm:max-w-md")}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="font-display text-xl">{title}</h2>
          <button onClick={onClose} className="text-2xl leading-none text-smoke" aria-label="Close">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function NoAccess() {
  return <Empty>You don&apos;t have access to this page. Ask the owner if you need it.</Empty>;
}

export const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }) : "—";
export const fmtDay = (d: string | null | undefined) =>
  d ? new Date(`${d.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "—";
