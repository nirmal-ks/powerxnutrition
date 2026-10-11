import { Suspense } from "react";
import { OrdersManager } from "@/components/admin/OrdersManager";
import { NoAccess, PageHeader } from "@/components/admin/ui";
import { getDb } from "@/lib/db";
import { pageAccess } from "@/lib/page-auth";
import { listOrders } from "@/lib/server/orders";

export const metadata = { title: "Online orders" };

export default async function AdminOrdersPage() {
  const { allowed } = await pageAccess("orders.manage");
  if (!allowed) return <NoAccess />;
  const orders = await listOrders(await getDb());
  return (
    <div>
      <PageHeader title="Online orders" subtitle="Confirm orders, verify UPI payments and update delivery. Cancelling returns the stock through a recorded reversal." />
      <Suspense>
        <OrdersManager orders={orders} />
      </Suspense>
    </div>
  );
}
