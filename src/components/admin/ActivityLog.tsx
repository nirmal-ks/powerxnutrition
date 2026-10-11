"use client";

import { useMemo, useState } from "react";
import type { AuditRow } from "@/lib/server/audit";
import { Alert, api, Badge, Empty, fmtDate, Spinner, useApi } from "./ui";

const GROUPS = [
  ["", "Everything"],
  ["sale.", "Sales & returns"],
  ["order.", "Online orders"],
  ["payment.", "Payments"],
  ["stock.", "Stock adjustments"],
  ["purchase.", "Purchases"],
  ["invoice.", "Invoice scans"],
  ["import.", "Excel imports"],
  ["product.", "Products & prices"],
  ["image.", "Photos"],
  ["settings.", "Settings & tax"],
  ["staff.", "Staff & permissions"],
  ["expense.", "Expenses"],
];

const tone = (a: string): "red" | "gold" | "green" | "blue" | "zinc" =>
  /cancel|void|delete|override|adjust|tax|permission|unpublish|mismatch|failed/.test(a) ? "red" : /return|corrected|price|discard/.test(a) ? "gold" : /completed|confirmed|approved|verified|placed/.test(a) ? "green" : /created|uploaded|extracted/.test(a) ? "blue" : "zinc";

export function ActivityLog() {
  const [f, setF] = useState({ action: "", user: "", q: "", from: "", to: "" });
  const url = useMemo(() => `/api/admin/audit?${new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][])}`, [f]);
  const { data, error, loading, setData } = useApi<{ logs: AuditRow[] }>(url);
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState<number | null>(null);

  const loadMore = async () => {
    if (!data?.logs.length) return;
    setMore(true);
    try {
      const d = await api<{ logs: AuditRow[] }>(`${url}&before=${data.logs[data.logs.length - 1].id}`);
      setData({ logs: [...data.logs, ...d.logs] });
    } finally {
      setMore(false);
    }
  };

  return (
    <div>
      <div className="mb-3 grid gap-2 sm:grid-cols-5">
        <select value={f.action} onChange={(e) => setF({ ...f, action: e.target.value })} className="input">
          {GROUPS.map(([v, l]) => <option key={v} value={v} className="bg-coal">{l}</option>)}
        </select>
        <input value={f.user} onChange={(e) => setF({ ...f, user: e.target.value })} placeholder="Staff name" className="input" />
        <input value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Search text / bill no" className="input" />
        <input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} className="input" aria-label="From" />
        <input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} className="input" aria-label="To" />
      </div>
      <a href={`${url}&format=csv`} className="mb-2 inline-block text-xs font-bold text-gold">⬇ Export CSV</a>
      {error && <Alert>{error}</Alert>}
      {loading && !data && <p className="p-6 text-center"><Spinner /></p>}
      {data && !data.logs.length && <Empty>No activity matches.</Empty>}
      <ul className="divide-y divide-white/5 rounded-2xl border border-white/8 bg-coal">
        {data?.logs.map((l) => (
          <li key={l.id} className="p-3 text-sm">
            <button onClick={() => setOpen(open === l.id ? null : l.id)} className="w-full text-left">
              <span className="flex flex-wrap items-center gap-2">
                <Badge tone={tone(l.action)}>{l.action}</Badge>
                <span className="text-xs text-smoke">{fmtDate(l.at)} · <b className="text-zinc-300">{l.user_name || "—"}</b>{l.role ? ` (${l.role})` : ""}</span>
              </span>
              <span className="mt-1 block">{l.summary}</span>
            </button>
            {open === l.id && l.details != null && <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-black/40 p-2 text-[0.7rem] text-zinc-300">{JSON.stringify(l.details, null, 2)}</pre>}
          </li>
        ))}
      </ul>
      {data && data.logs.length >= 100 && (
        <button onClick={loadMore} disabled={more} className="btn btn-ghost mt-3 w-full">{more && <Spinner />} Load older</button>
      )}
    </div>
  );
}
