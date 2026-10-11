"use client";

import Link from "next/link";
import { useState } from "react";
import { inr2 } from "@/lib/money";
import type { CustomerRow } from "@/lib/server/customers";
import { PhoneIcon, SearchIcon, WhatsAppIcon } from "../ui/Icons";
import { useCan } from "./SessionContext";
import { Alert, Badge, Empty, fmtDay, useApi } from "./ui";

export function CustomersView() {
  const can = useCan();
  const [q, setQ] = useState("");
  const { data, error, loading } = useApi<{ customers: CustomerRow[] }>(`/api/admin/customers${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <label className="relative flex-1">
          <SearchIcon size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-smoke" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, mobile or email" className="input pl-10" />
        </label>
        {can("reports.sales") && <a href="/api/admin/customers?format=csv" className="btn btn-ghost px-4! text-xs!">⬇ CSV</a>}
      </div>
      {error && <Alert>{error}</Alert>}
      {!loading && !data?.customers.length && <Empty>No customers yet.</Empty>}
      <ul className="space-y-2">
        {data?.customers.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/8 bg-coal p-3">
            <div>
              <p className="font-semibold">{c.name || "(no name)"} <span className="text-sm text-smoke">· {c.phone}</span></p>
              <p className="text-xs text-smoke">
                {c.online_orders > 0 && <Badge tone="blue">{c.online_orders} online</Badge>} {c.offline_bills > 0 && <Badge tone="purple">{c.offline_bills} shop</Badge>}
                {c.last_purchase ? ` · last ${fmtDay(c.last_purchase)}` : ""}
                {c.address?.city ? ` · ${c.address.city}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <b className="text-gold">{inr2(c.total_spent)}</b>
              <Link href={`/admin/sales?q=${c.phone}`} className="btn btn-ghost px-3! py-2! text-xs!">Bills</Link>
              <a href={`tel:+91${c.phone}`} className="btn btn-ghost px-3! py-2!" aria-label="Call"><PhoneIcon size={16} /></a>
              <a href={`https://wa.me/91${c.phone}`} target="_blank" rel="noopener" className="btn btn-whatsapp px-3! py-2!" aria-label="WhatsApp"><WhatsAppIcon size={16} /></a>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
