import { notFound } from "next/navigation";
import { InvoiceReviewScreen } from "@/components/admin/invoices/InvoiceReview";
import { NoAccess } from "@/components/admin/ui";
import { getDb } from "@/lib/db";
import { pageAccess } from "@/lib/page-auth";
import { aiProvider } from "@/lib/server/invoice-extract";
import type { InvoiceImportRow } from "@/lib/server/invoices";
import { reviewWarnings } from "@/lib/server/invoices";
import { categoryOptions, supplierOptions } from "@/lib/server/page-data";
import { getSettings } from "@/lib/server/settings";

export const metadata = { title: "Review invoice" };

export default async function InvoiceReviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ same?: string }> }) {
  const { allowed } = await pageAccess("purchases.create");
  if (!allowed) return <NoAccess />;
  const db = await getDb();
  const row = (await db.query<InvoiceImportRow>("select * from invoice_imports where id = $1", [(await params).id]))[0];
  if (!row) notFound();
  const s = await getSettings(db);
  const p = aiProvider();
  const { file_path: _f, ...inv } = row;
  return (
    <InvoiceReviewScreen
      invoice={inv}
      initialReviewWarnings={row.review ? reviewWarnings(row.review) : []}
      suppliers={await supplierOptions()}
      categories={categoryOptions()}
      ai={p ? { label: p.label, allowed: !p.external || s.ai.allowExternalInvoiceAi, kind: p.id } : null}
      sameFileAs={(await searchParams).same ?? null}
    />
  );
}
