import { PurchaseForm } from "@/components/admin/purchases/PurchaseForm";
import { NoAccess, PageHeader } from "@/components/admin/ui";
import { pageAccess } from "@/lib/page-auth";
import { categoryOptions, supplierOptions } from "@/lib/server/page-data";

export const metadata = { title: "New purchase" };

export default async function NewPurchasePage() {
  const { allowed } = await pageAccess("purchases.create");
  if (!allowed) return <NoAccess />;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New purchase" back={{ href: "/admin/purchases", label: "Purchases" }} subtitle="Save as draft any time — stock only changes when you confirm the receipt." />
      <PurchaseForm suppliers={await supplierOptions()} categories={categoryOptions()} />
    </div>
  );
}
