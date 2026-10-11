import { Dashboard } from "@/components/admin/dashboard/Dashboard";
import { NoAccess } from "@/components/admin/ui";
import { pageAccess } from "@/lib/page-auth";

export const metadata = { title: "Dashboard" };

export default async function AdminDashboard() {
  const { allowed } = await pageAccess("dashboard.view");
  if (!allowed) return <NoAccess />;
  return <Dashboard />;
}
