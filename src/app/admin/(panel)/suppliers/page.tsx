import { SuppliersView } from "@/components/admin/suppliers/SuppliersView";
import { NoAccess, PageHeader } from "@/components/admin/ui";
import { pageAccess } from "@/lib/page-auth";

export const metadata = { title: "Suppliers" };

export default async function SuppliersPage() {
  const { allowed } = await pageAccess(["suppliers.manage"]);
  if (!allowed) return <NoAccess />;
  return (
    <div>
      <PageHeader title="Suppliers" subtitle="Who you buy from: contact details, purchase & invoice history, what they supply and what you still owe." />
      <SuppliersView />
    </div>
  );
}
