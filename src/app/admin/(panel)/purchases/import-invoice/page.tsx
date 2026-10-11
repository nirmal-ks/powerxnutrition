import { InvoiceUpload } from "@/components/admin/invoices/InvoiceUpload";
import { NoAccess, PageHeader } from "@/components/admin/ui";
import { getDb } from "@/lib/db";
import { pageAccess } from "@/lib/page-auth";
import { aiProvider } from "@/lib/server/invoice-extract";
import { listInvoiceImports } from "@/lib/server/invoices";
import { getSettings } from "@/lib/server/settings";

export const metadata = { title: "Scan supplier invoice" };

export default async function ImportInvoicePage() {
  const { allowed } = await pageAccess("purchases.create");
  if (!allowed) return <NoAccess />;
  const db = await getDb();
  const [list, s] = await Promise.all([listInvoiceImports(db), getSettings(db)]);
  const p = aiProvider();
  return (
    <div>
      <PageHeader
        title="Scan supplier invoice"
        subtitle="Upload the supplier's bill (PDF or photo). It's read automatically, you check every line, then confirm — stock changes only after you confirm."
      />
      <InvoiceUpload
        invoices={list}
        ai={p ? { label: p.label, external: p.external, allowed: !p.external || s.ai.allowExternalInvoiceAi } : null}
      />
    </div>
  );
}
