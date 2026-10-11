import Link from "next/link";
import { PurchaseForm } from "@/components/admin/purchases/PurchaseForm";
import { NoAccess, PageHeader } from "@/components/admin/ui";
import { pageAccess } from "@/lib/page-auth";
import { categoryOptions, supplierOptions } from "@/lib/server/page-data";

export const metadata = { title: "Receive stock" };

/** Fast mobile form for small deliveries. Big deliveries: Excel import or scan the invoice. */
export default async function StockInPage() {
  const { allowed } = await pageAccess("purchases.create");
  if (!allowed) return <NoAccess />;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Receive stock"
        subtitle={<>Delivery arrived? Pick the supplier, scan or search each product, enter qty & cost, confirm. Big delivery? <Link href="/admin/purchases/import-invoice" className="text-gold underline">Scan the invoice</Link> or <Link href="/admin/inventory/import" className="text-gold underline">import Excel</Link>.</>}
      />
      <PurchaseForm suppliers={await supplierOptions()} categories={categoryOptions()} quick />
    </div>
  );
}
