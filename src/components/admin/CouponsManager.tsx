"use client";

import { useState } from "react";
import { cn, inr } from "@/lib/format";
import { couponLabel } from "@/lib/pricing";
import type { Coupon } from "@/types";
import { CopyIcon, PlusIcon, TrashIcon } from "../ui/Icons";

type Form = {
  code: string;
  type: "percent" | "flat";
  value: string;
  minOrder: string;
  maxDiscount: string;
  expiresAt: string;
  usageLimit: string;
  oncePerCustomer: boolean;
  showAtCheckout: boolean;
  description: string;
};

const BLANK: Form = {
  code: "",
  type: "percent",
  value: "10",
  minOrder: "0",
  maxDiscount: "0",
  expiresAt: "",
  usageLimit: "0",
  oncePerCustomer: true,
  showAtCheckout: true,
  description: "",
};

const toForm = (c: Coupon): Form => ({
  code: c.code,
  type: c.type,
  value: String(c.value),
  minOrder: String(c.minOrder),
  maxDiscount: String(c.maxDiscount),
  expiresAt: c.expiresAt ?? "",
  usageLimit: String(c.usageLimit),
  oncePerCustomer: c.oncePerCustomer,
  showAtCheckout: c.showAtCheckout,
  description: c.description ?? "",
});

const todayIST = () => new Date(Date.now() + 330 * 60 * 1000).toISOString().slice(0, 10);

function statusOf(c: Coupon) {
  if (!c.active) return { label: "Off", tone: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" };
  if (c.expiresAt && c.expiresAt < todayIST()) return { label: "Expired", tone: "bg-red-500/15 text-red-300 border-red-500/30" };
  if (c.usageLimit && c.used >= c.usageLimit) return { label: "Used up", tone: "bg-amber-500/15 text-amber-300 border-amber-500/30" };
  return { label: "Live", tone: "bg-green-500/15 text-green-300 border-green-500/30" };
}

export function CouponsManager({ coupons: initial }: { coupons: Coupon[] }) {
  const [coupons, setCoupons] = useState(initial);
  const [form, setForm] = useState<Form | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError("");
    const res = await fetch(editing ? `/api/admin/coupons/${encodeURIComponent(editing)}` : "/api/admin/coupons", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, expiresAt: form.expiresAt || "" }),
    });
    const data = (await res.json()) as { coupon?: Coupon; error?: string };
    setSaving(false);
    if (!res.ok || !data.coupon) return setError(data.error || "Could not save");
    setCoupons((prev) => (editing ? prev.map((c) => (c.code === editing ? data.coupon! : c)) : [data.coupon!, ...prev]));
    setForm(null);
    setEditing(null);
  };

  const patch = async (code: string, body: Partial<Coupon>) => {
    const res = await fetch(`/api/admin/coupons/${encodeURIComponent(code)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { coupon?: Coupon; error?: string };
    if (!res.ok || !data.coupon) return setError(data.error || "Update failed");
    setCoupons((prev) => prev.map((c) => (c.code === code ? data.coupon! : c)));
  };

  const remove = async (code: string) => {
    if (!window.confirm(`Delete coupon ${code}? Customers won't be able to use it any more.`)) return;
    const res = await fetch(`/api/admin/coupons/${encodeURIComponent(code)}`, { method: "DELETE" });
    if (res.ok) setCoupons((prev) => prev.filter((c) => c.code !== code));
  };

  return (
    <div className="space-y-6">
      {!form && (
        <button
          onClick={() => {
            setForm(BLANK);
            setEditing(null);
          }}
          className="btn btn-red"
        >
          <PlusIcon size={18} /> New coupon
        </button>
      )}

      {form && (
        <form onSubmit={save} className="space-y-5 rounded-2xl border border-gold/30 bg-coal p-5 sm:p-6">
          <h2 className="font-display text-2xl">{editing ? `Edit ${editing}` : "New coupon"}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Code (customers type this)">
              <input
                value={form.code}
                onChange={(e) => set("code", e.target.value.toUpperCase().replace(/\s/g, ""))}
                disabled={!!editing}
                placeholder="FIRST10"
                className="input uppercase tracking-wider disabled:opacity-60"
                required
              />
            </Field>
            <Field label="Short description (shown at checkout)">
              <input value={form.description} onChange={(e) => set("description", e.target.value)} maxLength={80} placeholder="10% off your first order" className="input" />
            </Field>
            <Field label="Discount type">
              <div className="grid grid-cols-2 gap-2">
                {(["percent", "flat"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set("type", t)}
                    className={cn("rounded-xl border px-3 py-3 text-sm font-bold transition", form.type === t ? "border-gold bg-gold/15 text-gold" : "border-white/10 text-zinc-300")}
                  >
                    {t === "percent" ? "% off" : "₹ flat off"}
                  </button>
                ))}
              </div>
            </Field>
            <Field label={form.type === "percent" ? "Percentage off" : "Amount off (₹)"}>
              <input type="number" min={1} max={form.type === "percent" ? 90 : undefined} value={form.value} onChange={(e) => set("value", e.target.value)} className="input" required />
            </Field>
            <Field label="Minimum order (₹, 0 = none)">
              <input type="number" min={0} value={form.minOrder} onChange={(e) => set("minOrder", e.target.value)} className="input" />
            </Field>
            {form.type === "percent" && (
              <Field label="Max discount (₹, 0 = no cap)">
                <input type="number" min={0} value={form.maxDiscount} onChange={(e) => set("maxDiscount", e.target.value)} className="input" />
              </Field>
            )}
            <Field label="Last valid day (empty = never expires)">
              <input type="date" value={form.expiresAt} onChange={(e) => set("expiresAt", e.target.value)} className="input" />
            </Field>
            <Field label="Total uses allowed (0 = unlimited)">
              <input type="number" min={0} value={form.usageLimit} onChange={(e) => set("usageLimit", e.target.value)} className="input" />
            </Field>
          </div>
          <div className="space-y-3">
            <Toggle checked={form.oncePerCustomer} onChange={(v) => set("oncePerCustomer", v)} label="One use per customer (by mobile number)" />
            <Toggle checked={form.showAtCheckout} onChange={(v) => set("showAtCheckout", v)} label="Show as an offer at checkout (otherwise it's a secret code)" />
          </div>
          {error && <p className="rounded-xl border border-ember/40 bg-ember/10 p-3 text-sm text-ember">{error}</p>}
          <div className="flex flex-wrap gap-3">
            <button disabled={saving} className="btn btn-red">{saving ? "Saving…" : editing ? "Save changes" : "Create coupon"}</button>
            <button
              type="button"
              onClick={() => {
                setForm(null);
                setEditing(null);
                setError("");
              }}
              className="btn btn-ghost"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && !form && <p className="rounded-xl border border-ember/40 bg-ember/10 p-3 text-sm text-ember">{error}</p>}

      {!coupons.length ? (
        <p className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-smoke">
          No coupons yet. Create one like <b className="text-white">FIRST10</b> — 10% off the first order.
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {coupons.map((c) => {
            const st = statusOf(c);
            return (
              <li key={c.code} className="rounded-2xl border border-white/8 bg-coal p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => navigator.clipboard?.writeText(c.code)}
                        title="Copy code"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gold/50 bg-gold/10 px-2.5 py-1 font-mono text-sm font-extrabold tracking-wider text-gold"
                      >
                        {c.code} <CopyIcon size={12} />
                      </button>
                      <span className={cn("rounded-full border px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider", st.tone)}>{st.label}</span>
                    </div>
                    <p className="mt-2 font-semibold">{c.description || couponLabel(c)}</p>
                    <p className="mt-1 text-xs text-smoke">
                      {couponLabel(c)} · {c.minOrder ? `min ${inr(c.minOrder)}` : "no minimum"}
                      {c.expiresAt ? ` · till ${c.expiresAt.split("-").reverse().join("/")}` : ""}
                      {c.oncePerCustomer ? " · once per customer" : ""}
                      {c.showAtCheckout ? " · shown at checkout" : " · secret code"}
                    </p>
                    <p className="mt-1 text-xs text-zinc-300">
                      Used <b className="text-white">{c.used}</b>
                      {c.usageLimit ? ` / ${c.usageLimit}` : ""} times
                    </p>
                  </div>
                  <Toggle compact checked={c.active} onChange={(v) => patch(c.code, { active: v })} label={c.active ? "On" : "Off"} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2 border-t border-white/5 pt-3 text-xs font-bold">
                  <button
                    onClick={() => {
                      setForm(toForm(c));
                      setEditing(c.code);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="rounded-full border border-white/10 px-3 py-1.5 hover:border-gold/50"
                  >
                    Edit
                  </button>
                  {c.used > 0 && (
                    <button onClick={() => patch(c.code, { used: 0 })} className="rounded-full border border-white/10 px-3 py-1.5 hover:border-gold/50">
                      Reset usage
                    </button>
                  )}
                  <button onClick={() => remove(c.code)} className="ml-auto inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-smoke hover:text-ember">
                    <TrashIcon size={14} /> Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ checked, onChange, label, compact }: { checked: boolean; onChange: (v: boolean) => void; label: string; compact?: boolean }) {
  return (
    <label className={cn("flex cursor-pointer items-center gap-3 text-sm", compact && "shrink-0 flex-col gap-1 text-[0.65rem] font-bold uppercase text-smoke")}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span className={cn("relative h-6 w-11 shrink-0 rounded-full transition", checked ? "bg-green-500" : "bg-white/15")}>
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", checked ? "left-[1.375rem]" : "left-0.5")} />
      </span>
      {label}
    </label>
  );
}
