import { ReportsView } from "@/components/admin/ReportsView";
import { NoAccess, PageHeader } from "@/components/admin/ui";
import { pageAccess } from "@/lib/page-auth";

export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  const { allowed } = await pageAccess("reports.sales");
  if (!allowed) return <NoAccess />;
  return (
    <div>
      <PageHeader title="Reports" subtitle="Real figures from the database. Every table can be downloaded as CSV (opens in Excel)." />
      <ReportsView />
    </div>
  );
}
