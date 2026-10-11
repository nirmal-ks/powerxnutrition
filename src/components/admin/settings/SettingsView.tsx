"use client";

import { useState } from "react";
import { ROLES, type Actor, type Role } from "@/lib/permissions";
import type { AiSettings, AllSettings, OperationsSettings } from "@/lib/settings-types";
import type { StaffRow } from "@/lib/server/staff";
import { Alert, api, Badge, Card, Field, fmtDay, Spinner } from "../ui";

interface Integrations {
  database: string;
  storage: string;
  ai: string | null;
  googleImages: boolean;
  razorpay: boolean;
  razorpayWebhook: boolean;
}

export function SettingsView({ actor, settings, staff, integrations }: { actor: Actor; settings: AllSettings | null; staff: StaffRow[]; integrations: Integrations | null }) {
  return (
    <div className="space-y-4">
      {settings && <Operations initial={settings.operations} />}
      {settings && <AiPanel initial={settings.ai} integrations={integrations!} />}
      {staff.length > 0 && <Staff initial={staff} me={actor.id} />}
      <MyPassword actor={actor} />
    </div>
  );
}

function useSave<T>(group: string, initial: T) {
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const d = await api<{ saved: T }>("/api/admin/settings", { method: "PUT", json: { group, values: v } });
      setV(d.saved);
      setMsg({ ok: true, text: "Saved ✔" });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  return { v, setV, busy, msg, save };
}

function Operations({ initial }: { initial: OperationsSettings }) {
  const { v, setV, busy, msg, save } = useSave("operations", initial);
  return (
    <Card title="Shop rules">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="When do online orders take stock?" hint="“Order placed” reserves stock immediately so the shop can't sell the same unit twice (recommended).">
          <select value={v.onlineStockStage} onChange={(e) => setV({ ...v, onlineStockStage: e.target.value as "placed" | "confirmed" })} className="input">
            <option value="placed" className="bg-coal">When the order is placed</option>
            <option value="confirmed" className="bg-coal">When I confirm the order</option>
          </select>
        </Field>
        <Field label="Expiry alert (days before)"><input type="number" min={1} value={v.expiryAlertDays} onChange={(e) => setV({ ...v, expiryAlertDays: Number(e.target.value) })} className="input" /></Field>
        <Field label="Cashier max discount %"><input type="number" min={0} max={100} value={v.cashierMaxDiscountPct} onChange={(e) => setV({ ...v, cashierMaxDiscountPct: Number(e.target.value) })} className="input" /></Field>
        <Field label="Manager max discount %"><input type="number" min={0} max={100} value={v.managerMaxDiscountPct} onChange={(e) => setV({ ...v, managerMaxDiscountPct: Number(e.target.value) })} className="input" /></Field>
        <Field label="Default low-stock level"><input type="number" min={0} value={v.defaultMinStock} onChange={(e) => setV({ ...v, defaultMinStock: Number(e.target.value) })} className="input" /></Field>
        <div>
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-400">Shop payment methods</span>
          <div className="flex flex-wrap gap-3 text-sm">
            {(["cash", "upi", "card", "other"] as const).map((m) => (
              <label key={m} className="flex items-center gap-1.5"><input type="checkbox" checked={v.paymentMethods[m]} onChange={(e) => setV({ ...v, paymentMethods: { ...v.paymentMethods, [m]: e.target.checked } })} /> {m.toUpperCase()}</label>
            ))}
          </div>
        </div>
        <label className="flex items-start gap-2 rounded-xl border border-ember/30 p-3 text-sm sm:col-span-2">
          <input type="checkbox" className="mt-1" checked={v.allowNegativeStock} onChange={(e) => setV({ ...v, allowNegativeStock: e.target.checked })} />
          <span><b>Allow selling below zero stock</b><span className="block text-xs text-smoke">Not recommended. Only if goods sometimes arrive before they&apos;re entered. Stock can then show negative until received.</span></span>
        </label>
      </div>
      {msg && <Alert tone={msg.ok ? "ok" : "error"} className="mt-3">{msg.text}</Alert>}
      <button onClick={save} disabled={busy} className="btn btn-red mt-3">{busy && <Spinner />} Save shop rules</button>
    </Card>
  );
}

function AiPanel({ initial, integrations: i }: { initial: AiSettings; integrations: Integrations }) {
  const { v, setV, busy, msg, save } = useSave("ai", initial);
  const ok = (b: boolean, yes: string, no: string) => (b ? <Badge tone="green">{yes}</Badge> : <Badge>{no}</Badge>);
  return (
    <Card title="AI, WhatsApp & integrations (free options)">
      <ul className="mb-4 space-y-1.5 text-sm">
        <li>Database: <b>{i.database}</b></li>
        <li>Files & photos: <b>{i.storage}</b></li>
        <li>Invoice AI: {i.ai ? <Badge tone="green">{i.ai}</Badge> : <Badge>not set — free text reader is used</Badge>} <span className="text-xs text-smoke">(free: GEMINI_API_KEY from aistudio.google.com, or a local Ollama via AI_BASE_URL)</span></li>
        <li>Photo search: <Badge tone="green">Open Food Facts (free)</Badge> {ok(i.googleImages, "Google Programmable Search", "Google not set (optional)")}</li>
        <li>WhatsApp: <Badge tone="green">wa.me links — free, staff press send</Badge></li>
        <li>Online card/UPI gateway: {ok(i.razorpay, "Razorpay on", "off — UPI QR + COD work without it")} {i.razorpay && ok(i.razorpayWebhook, "webhook secret set", "set RAZORPAY_WEBHOOK_SECRET")}</li>
      </ul>
      <div className="space-y-2 text-sm">
        <label className="flex items-start gap-2 rounded-xl border border-white/10 p-3">
          <input type="checkbox" className="mt-1" checked={v.allowExternalInvoiceAi} onChange={(e) => setV({ ...v, allowExternalInvoiceAi: e.target.checked })} />
          <span><b>Allow sending supplier invoices to the external AI service</b><span className="block text-xs text-smoke">Invoices contain supplier details & prices. On Google&apos;s free tier, Google may use the data to improve its products. Leave OFF to use only the on-device text reader (or a local Ollama).</span></span>
        </label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={v.imageSearchEnabled} onChange={(e) => setV({ ...v, imageSearchEnabled: e.target.checked })} /> Search free image sources for new products&apos; photos (always needs approval)</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={v.aiImageCheck} onChange={(e) => setV({ ...v, aiImageCheck: e.target.checked })} /> Allow “ask AI to double-check” on photo candidates (uses Gemini; advisory only)</label>
      </div>
      {msg && <Alert tone={msg.ok ? "ok" : "error"} className="mt-3">{msg.text}</Alert>}
      <button onClick={save} disabled={busy} className="btn btn-red mt-3">{busy && <Spinner />} Save</button>
    </Card>
  );
}

function Staff({ initial, me }: { initial: StaffRow[]; me: string }) {
  const [list, setList] = useState(initial);
  const [f, setF] = useState({ name: "", username: "", role: "cashier" as Role, password: "", phone: "" });
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const add = async () => {
    setBusy("add");
    setMsg(null);
    try {
      const d = await api<{ staff: StaffRow }>("/api/admin/staff", { method: "POST", json: f });
      setList((l) => [...l, d.staff]);
      setF({ name: "", username: "", role: "cashier", password: "", phone: "" });
      setMsg({ ok: true, text: `Added ${d.staff.name}. They log in with username “${d.staff.username}”.` });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy("");
    }
  };
  const update = async (s: StaffRow, patch: Record<string, unknown>) => {
    setBusy(s.id);
    setMsg(null);
    try {
      const d = await api<{ staff: StaffRow }>(`/api/admin/staff/${s.id}`, { method: "PATCH", json: patch });
      setList((l) => l.map((x) => (x.id === s.id ? d.staff : x)));
      setMsg({ ok: true, text: `Updated ${s.name}${patch.role || patch.active === false || patch.password ? " — they were signed out on all devices" : ""}.` });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy("");
    }
  };

  return (
    <Card title="Staff logins & roles">
      <ul className="mb-3 grid gap-1 text-xs text-smoke sm:grid-cols-2">
        {ROLES.map((r) => <li key={r.id}><b className="text-zinc-300">{r.label}:</b> {r.description}</li>)}
      </ul>
      <ul className="divide-y divide-white/5">
        {list.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
            <span className="min-w-0 flex-1">
              <b>{s.name}</b> <span className="text-smoke">@{s.username}</span> {!s.active && <Badge tone="red">disabled</Badge>} {s.id === me && <Badge tone="blue">you</Badge>}
              <span className="block text-xs text-smoke">since {fmtDay(s.created_at)}</span>
            </span>
            {s.id === "owner" ? (
              <Badge tone="gold">Owner (ADMIN_PASSWORD)</Badge>
            ) : (
              <>
                <select value={s.role} disabled={busy === s.id} onChange={(e) => update(s, { role: e.target.value })} className="input w-auto! py-1.5! text-xs">
                  {ROLES.map((r) => <option key={r.id} value={r.id} className="bg-coal">{r.label}</option>)}
                </select>
                <button onClick={() => { const p = window.prompt(`New password for ${s.name} (min 8 characters):`); if (p) update(s, { password: p }); }} className="text-xs text-gold underline">Reset password</button>
                {s.id !== me && <button onClick={() => update(s, { active: !s.active })} className="text-xs text-smoke underline">{s.active ? "Disable" : "Enable"}</button>}
              </>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-4 grid gap-2 rounded-xl border border-white/10 p-3 sm:grid-cols-5">
        <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Name" className="input py-2! sm:col-span-1" />
        <input value={f.username} onChange={(e) => setF({ ...f, username: e.target.value.toLowerCase().replace(/\s/g, "") })} placeholder="username" autoCapitalize="none" className="input py-2!" />
        <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })} className="input py-2!">
          {ROLES.filter((r) => r.id !== "owner").concat(ROLES.filter((r) => r.id === "owner")).map((r) => <option key={r.id} value={r.id} className="bg-coal">{r.label}</option>)}
        </select>
        <input value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} type="text" placeholder="Password (8+)" className="input py-2!" autoComplete="new-password" />
        <button onClick={add} disabled={busy === "add" || !f.name || !f.username || f.password.length < 8} className="btn btn-gold py-2!">{busy === "add" && <Spinner />} Add staff</button>
      </div>
      {msg && <Alert tone={msg.ok ? "ok" : "error"} className="mt-3">{msg.text}</Alert>}
    </Card>
  );
}

function MyPassword({ actor }: { actor: Actor }) {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (actor.id === "owner") {
    return <Card title="Owner password"><p className="text-sm text-smoke">The main owner password is <code>ADMIN_PASSWORD</code> in the server environment (.env.local or Vercel settings). Change it there and restart.</p></Card>;
  }
  return (
    <Card title="Change my password">
      <div className="grid gap-2 sm:grid-cols-3">
        <input type="password" value={cur} onChange={(e) => setCur(e.target.value)} placeholder="Current password" className="input" autoComplete="current-password" />
        <input type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="New password (8+)" className="input" autoComplete="new-password" />
        <button
          onClick={async () => {
            try {
              await api("/api/admin/staff/me", { method: "PATCH", json: { current: cur, next } });
              setMsg({ ok: true, text: "Password changed — please log in again." });
              setTimeout(() => (window.location.href = "/admin/login"), 1200);
            } catch (e) {
              setMsg({ ok: false, text: (e as Error).message });
            }
          }}
          className="btn btn-gold"
        >
          Change
        </button>
      </div>
      {msg && <Alert tone={msg.ok ? "ok" : "error"} className="mt-3">{msg.text}</Alert>}
    </Card>
  );
}
