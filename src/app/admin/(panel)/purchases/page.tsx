import Link from "next/link";
import { Badge, Empty, fmtDate, NoAccess, PageHeader } from "@/components/admin/ui";
import { getDb } from "@/lib/db";
import { inr2 } from "@/lib/money";
import { pageAccess } from "@/lib/page-auth";
import { listPurchases } from "@/lib/server/purchases";

export const metadata = { title: "Purchases" };

const SOURCE: Record<string, string> = { manual: "Manual", csv: "Excel/CSV", invoice: "Invoice scan" };

export default async function PurchasesPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const { allowed } = await pageAccess("purchases.create");
  if (!allowed) return <NoAccess />;
  const sp = await searchParams;
  const rows = await listPurchases(await getDb(), { status: sp.status, search: sp.q, limit: 300 });
  const tabs = [
    { id: "", label: "All" },
    { id: "draft", label: "Drafts" },
    { id: "confirmed", label: "Received" },
    { id: "cancelled", label: "Cancelled" },
  ];
  return (
    <div>
      <PageHeader
        title="Purchases"
        subtitle="Stock received from suppliers. Drafts don't change stock until confirmed."
        actions={
          <>
            <Link href="/admin/inventory/stock-in" className="btn btn-red px-4! py-2.5! text-sm!">+ Receive stock</Link>
            <Link href="/admin/purchases/import-invoice" className="btn btn-ghost px-4! py-2.5! text-sm!">Scan invoice (AI)</Link>
            <Link href="/admin/inventory/import" className="btn btn-ghost px-4! py-2.5! text-sm!">Excel import</Link>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {tabs.map((t) => (
          <Link key={t.id} href={`/admin/purchases${t.id ? `?status=${t.id}` : ""}`} className={`rounded-full border px-4 py-2 text-xs font-bold uppercase ${(sp.status ?? "") === t.id ? "border-transparent bg-blood text-white" : "border-white/10 text-zinc-400"}`}>
            {t.label}
          </Link>
        ))}
        <form className="ml-auto">
          {sp.status && <input type="hidden" name="status" value={sp.status} />}
          <input name="q" defaultValue={sp.q} placeholder="PO no, invoice no, supplier…" className="input w-64! py-2!" />
        </form>
      </div>
      {!rows.length && <Empty>No purchases yet. Tap “Receive stock” when a delivery arrives.</Empty>}
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`/admin/purchases/${r.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/8 bg-coal p-3 hover:border-gold/40">
              <span>
                <span className="flex flex-wrap items-center gap-2 font-semibold">
                  {r.purchase_no} · {r.supplier_name}
                  <Badge tone={r.status === "confirmed" ? "green" : r.status === "draft" ? "gold" : "zinc"}>{r.status === "confirmed" ? "received" : r.status}</Badge>
                  <Badge>{SOURCE[r.source] ?? r.source}</Badge>
                </span>
                <span className="block text-xs text-smoke">
                  {r.supplier_invoice_no ? `Invoice ${r.supplier_invoice_no} · ` : ""}{r.lines} line(s) · {r.units} unit(s) · {fmtDate(r.confirmed_at ?? r.created_at)}
                </span>
              </span>
              <span className="text-right">
                <b className="text-gold">{inr2(r.total)}</b>
                {r.status === "confirmed" && r.paid_amount < r.total && <span className="block text-[0.7rem] text-ember">due {inr2(r.total - r.paid_amount)}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
