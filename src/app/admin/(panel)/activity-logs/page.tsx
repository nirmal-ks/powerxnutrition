import { ActivityLog } from "@/components/admin/ActivityLog";
import { NoAccess, PageHeader } from "@/components/admin/ui";
import { pageAccess } from "@/lib/page-auth";

export const metadata = { title: "Activity log" };

export default async function ActivityLogsPage() {
  const { allowed } = await pageAccess("audit.view");
  if (!allowed) return <NoAccess />;
  return (
    <div>
      <PageHeader title="Activity log" subtitle="Who did what and when — sales, returns, stock changes, purchases, price & tax changes, staff changes. Entries can't be edited or deleted by anyone." />
      <ActivityLog />
    </div>
  );
}
