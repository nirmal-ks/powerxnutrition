import { StockImport } from "@/components/admin/inventory/StockImport";
import { NoAccess, PageHeader } from "@/components/admin/ui";
import { pageAccess } from "@/lib/page-auth";
import { categoryOptions, supplierOptions } from "@/lib/server/page-data";

export const metadata = { title: "Excel / CSV stock import" };

export default async function ImportPage() {
  const { allowed } = await pageAccess("purchases.create");
  if (!allowed) return <NoAccess />;
  return (
    <div>
      <PageHeader
        title="Excel / CSV import"
        subtitle="Upload → check the preview → fix or reject rows → confirm. Uploading never changes stock; only the final confirm does (all rows together, or nothing)."
      />
      <StockImport suppliers={await supplierOptions()} categories={categoryOptions()} />
    </div>
  );
}
