import { notFound } from "next/navigation";
import { PurchaseActions } from "@/components/admin/purchases/PurchaseActions";
import { PurchaseForm } from "@/components/admin/purchases/PurchaseForm";
import { Alert, Badge, Card, fmtDate, fmtDay, NoAccess, PageHeader } from "@/components/admin/ui";
import { getDb } from "@/lib/db";
import { inr2 } from "@/lib/money";
import { pageAccess } from "@/lib/page-auth";
import { getPurchase } from "@/lib/server/purchases";
import { categoryOptions, supplierOptions } from "@/lib/server/page-data";

export const metadata = { title: "Purchase" };

export default async function PurchasePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; edit?: string }> }) {
  const { allowed } = await pageAccess("purchases.create");
  if (!allowed) return <NoAccess />;
  const p = await getPurchase(await getDb(), (await params).id);
  if (!p) notFound();
  const sp = await searchParams;

  if (p.status === "draft" && sp.edit === "1") {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title={`Edit draft ${p.purchase_no}`} back={{ href: `/admin/purchases/${p.id}`, label: p.purchase_no }} />
        <PurchaseForm suppliers={await supplierOptions()} categories={categoryOptions()} draft={p} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title={p.purchase_no}
        back={{ href: "/admin/purchases", label: "Purchases" }}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {p.supplier_name}
            <Badge tone={p.status === "confirmed" ? "green" : p.status === "draft" ? "gold" : "zinc"}>{p.status === "confirmed" ? "received" : p.status}</Badge>
          </span>
        }
      />
      {sp.saved === "confirmed" && <Alert tone="ok">Stock received ✔ — inventory updated and recorded in the movement history.</Alert>}
      {sp.saved === "draft" && <Alert tone="info">Draft saved. Stock has NOT changed yet — confirm the receipt when the goods are checked.</Alert>}
      {p.duplicate_override_reason && <Alert tone="warn">Received again despite duplicate invoice number: {p.duplicate_override_reason}</Alert>}
      <Card>
        <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <div><dt className="text-xs text-smoke">Supplier invoice</dt><dd>{p.supplier_invoice_no || "—"}</dd></div>
          <div><dt className="text-xs text-smoke">Invoice date</dt><dd>{fmtDay(p.invoice_date)}</dd></div>
          <div><dt className="text-xs text-smoke">Created</dt><dd>{fmtDate(p.created_at)}{p.created_by_name ? ` · ${p.created_by_name}` : ""}</dd></div>
          <div><dt className="text-xs text-smoke">Received</dt><dd>{p.confirmed_at ? `${fmtDate(p.confirmed_at)} · ${p.confirmed_by_name ?? ""}` : "—"}</dd></div>
        </dl>
        {p.notes && <p className="mt-3 text-sm text-zinc-300">{p.notes}</p>}
      </Card>
      <Card title="Items">
        <ul className="divide-y divide-white/5 text-sm">
          {p.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-3 py-2">
              <span>
                {i.product_name ? `${i.product_name} · ${[i.label, i.flavour].filter(Boolean).join(" · ")}` : i.new_product ? <><b className="text-gold">NEW</b> {i.new_product.brand} {i.new_product.name} · {i.new_product.label}</> : i.description}
                <span className="block text-xs text-smoke">
                  {i.qty} × {inr2(i.unit_cost)}{i.tax_rate !== null ? ` + ${i.tax_rate}% GST` : ""}{i.batch_no ? ` · batch ${i.batch_no}` : ""}{i.expiry_date ? ` · exp ${fmtDay(i.expiry_date)}` : ""}
                </span>
              </span>
              <b>{inr2(i.line_total)}</b>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1 border-t border-white/10 pt-3 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{inr2(p.subtotal)}</dd></div>
          {p.tax_total > 0 && <div className="flex justify-between"><dt>GST</dt><dd>{inr2(p.tax_total)}</dd></div>}
          {p.discount_total > 0 && <div className="flex justify-between"><dt>Discount</dt><dd>− {inr2(p.discount_total)}</dd></div>}
          {p.other_charges > 0 && <div className="flex justify-between"><dt>Other charges</dt><dd>{inr2(p.other_charges)}</dd></div>}
          <div className="flex justify-between text-lg font-extrabold"><dt>Total</dt><dd className="text-gold">{inr2(p.total)}</dd></div>
          {p.status === "confirmed" && <div className="flex justify-between text-smoke"><dt>Paid to supplier</dt><dd>{inr2(p.paid_amount)} {p.paid_amount < p.total ? `(due ${inr2(p.total - p.paid_amount)})` : "✔"}</dd></div>}
        </dl>
      </Card>
      <PurchaseActions id={p.id} status={p.status} due={Math.max(0, p.total - p.paid_amount)} invoiceImportId={p.invoice_import_id} />
    </div>
  );
}
