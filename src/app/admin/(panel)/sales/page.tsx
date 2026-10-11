import Link from "next/link";
import { SalesHistory } from "@/components/admin/sales/SalesHistory";
import { NoAccess, PageHeader } from "@/components/admin/ui";
import { pageAccess } from "@/lib/page-auth";
import { can } from "@/lib/permissions";

export const metadata = { title: "Bills & returns" };

export default async function SalesPage() {
  const { actor, allowed } = await pageAccess("sales.view");
  if (!allowed) return <NoAccess />;
  return (
    <div>
      <PageHeader
        title="Bills & returns"
        subtitle={can(actor.role, "sales.return") ? "Every online and shop sale. Open a bill to reprint, share, return or cancel it." : "Your bills. Open one to reprint or share it."}
        actions={can(actor.role, "sales.create") ? <Link href="/admin/sales/new" className="btn btn-red">+ New bill</Link> : null}
      />
      <SalesHistory canSeeAll={can(actor.role, "sales.return")} />
    </div>
  );
}
