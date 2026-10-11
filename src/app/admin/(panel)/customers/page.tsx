import { CustomersView } from "@/components/admin/CustomersView";
import { NoAccess, PageHeader } from "@/components/admin/ui";
import { pageAccess } from "@/lib/page-auth";

export const metadata = { title: "Customers" };

export default async function CustomersPage() {
  const { allowed } = await pageAccess("customers.view");
  if (!allowed) return <NoAccess />;
  return (
    <div>
      <PageHeader title="Customers" subtitle="Built automatically from online orders and shop bills with a mobile number." />
      <CustomersView />
    </div>
  );
}
