import { CouponsManager } from "@/components/admin/CouponsManager";
import { NoAccess } from "@/components/admin/ui";
import { pageAccess } from "@/lib/page-auth";
import { getStore } from "@/lib/store";

export const metadata = { title: "Coupons" };

export default async function AdminCouponsPage() {
  const { allowed } = await pageAccess("coupons.manage");
  if (!allowed) return <NoAccess />;
  const coupons = await getStore().listCoupons();
  return (
    <div>
      <h1 className="font-display text-4xl">Coupons</h1>
      <p className="mb-6 text-sm text-smoke">Create discount codes. Customers apply them at checkout — the discount is checked again on the server when the order is placed.</p>
      <CouponsManager coupons={coupons} />
    </div>
  );
}
