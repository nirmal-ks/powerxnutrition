"use client";

import { useMemo, useState } from "react";
import { inr2 } from "@/lib/money";
import type { ExpenseRow } from "@/lib/server/expenses";
import { Alert, api, Badge, Card, Empty, Field, fmtDay, istDaysAgo, istToday, Spinner, useApi } from "./ui";

export function ExpensesView({ categories }: { categories: { id: string; label: string }[] }) {
  const [from, setFrom] = useState(istToday().slice(0, 8) + "01");
  const [to, setTo] = useState(istToday());
  const [cat, setCat] = useState("");
  const [showVoided, setShowVoided] = useState(false);
  const url = useMemo(() => `/api/admin/expenses?${new URLSearchParams({ from, to, ...(cat ? { category: cat } : {}), ...(showVoided ? { voided: "1" } : {}) })}`, [from, to, cat, showVoided]);
  const { data, reload, error } = useApi<{ expenses: ExpenseRow[] }>(url);
  const label = (id: string) => categories.find((c) => c.id === id)?.label ?? id;
  const total = data?.expenses.filter((e) => !e.voided).reduce((s, e) => s + e.amount, 0) ?? 0;
  const byCat = new Map<string, number>();
  data?.expenses.filter((e) => !e.voided).forEach((e) => byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount));

  return (
    <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
      <AddExpense categories={categories} onAdded={reload} />
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input w-auto! py-2!" aria-label="From" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input w-auto! py-2!" aria-label="To" />
          <select value={cat} onChange={(e) => setCat(e.target.value)} className="input w-auto! py-2!">
            <option value="" className="bg-coal">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.id} className="bg-coal">{c.label}</option>)}
          </select>
          <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={showVoided} onChange={(e) => setShowVoided(e.target.checked)} /> show voided</label>
          <button onClick={() => { setFrom(istDaysAgo(29)); setTo(istToday()); }} className="text-xs font-bold text-gold">30 days</button>
          <a href={`${url}&format=csv`} className="ml-auto text-xs font-bold text-gold">⬇ CSV</a>
        </div>
        <Card title={`Total ${inr2(total)}`}>
          <div className="flex flex-wrap gap-2">
            {[...byCat.entries()].sort((a, b) => b[1] - a[1]).map(([c, v]) => <Badge key={c} tone="gold">{label(c)} {inr2(v)}</Badge>)}
          </div>
        </Card>
        {error && <Alert>{error}</Alert>}
        {data && !data.expenses.length && <Empty>No expenses recorded in this period.</Empty>}
        <ul className="space-y-2">
          {data?.expenses.map((e) => (
            <li key={e.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/8 bg-coal p-3 ${e.voided ? "opacity-50" : ""}`}>
              <div>
                <p className="font-semibold">{label(e.category)} <span className="text-sm font-normal text-smoke">· {fmtDay(e.expense_date)}</span> {e.voided && <Badge tone="red">voided</Badge>}</p>
                <p className="text-xs text-smoke">{e.description || "—"}{e.payment_method ? ` · ${e.payment_method}` : ""} · by {e.created_by_name}{e.void_reason ? ` · void: ${e.void_reason}` : ""}</p>
              </div>
              <div className="flex items-center gap-3">
                <b>{inr2(e.amount)}</b>
                {e.receipt_path && <a href={`/api/admin/expenses/${e.id}`} target="_blank" className="text-xs text-gold underline">receipt</a>}
                {!e.voided && (
                  <button
                    onClick={async () => {
                      const r = window.prompt("Reason for voiding this expense? (it stays in the log)");
                      if (!r) return;
                      try {
                        await api(`/api/admin/expenses/${e.id}`, { method: "POST", json: { reason: r } });
                        reload();
                      } catch (err) {
                        window.alert((err as Error).message);
                      }
                    }}
                    className="text-xs text-smoke hover:text-ember"
                  >
                    Void
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function AddExpense({ categories, onAdded }: { categories: { id: string; label: string }[]; onAdded: () => void }) {
  const [f, setF] = useState({ date: istToday(), category: "rent", amount: "", description: "", paymentMethod: "cash" });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData();
      Object.entries(f).forEach(([k, v]) => fd.append(k, v));
      if (file) fd.append("receipt", file);
      await api("/api/admin/expenses", { method: "POST", body: fd });
      setMsg({ ok: true, text: "Expense saved ✔" });
      setF({ ...f, amount: "", description: "" });
      setFile(null);
      onAdded();
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card title="Add expense" className="lg:sticky lg:top-6 lg:self-start">
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Date"><input type="date" value={f.date} max={istToday()} onChange={(e) => setF({ ...f, date: e.target.value })} className="input" required /></Field>
          <Field label="Amount ₹"><input value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d.]/g, "") })} inputMode="decimal" className="input text-lg" required /></Field>
        </div>
        <Field label="Category">
          <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} className="input">
            {categories.map((c) => <option key={c.id} value={c.id} className="bg-coal">{c.label}</option>)}
          </select>
        </Field>
        <Field label="Description"><input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className="input" placeholder="e.g. October rent" /></Field>
        <Field label="Paid by">
          <select value={f.paymentMethod} onChange={(e) => setF({ ...f, paymentMethod: e.target.value })} className="input">
            {["cash", "upi", "card", "bank", "other"].map((m) => <option key={m} value={m} className="bg-coal">{m.toUpperCase()}</option>)}
          </select>
        </Field>
        <Field label="Receipt photo / PDF (optional)">
          <input type="file" accept="image/*,application/pdf" capture="environment" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="input py-2!" />
        </Field>
        {msg && <Alert tone={msg.ok ? "ok" : "error"}>{msg.text}</Alert>}
        <button disabled={busy || !f.amount} className="btn btn-red w-full">{busy && <Spinner />} Save expense</button>
      </form>
    </Card>
  );
}
