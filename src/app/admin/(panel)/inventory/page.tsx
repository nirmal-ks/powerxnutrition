import { Suspense } from "react";
import { InventoryView } from "@/components/admin/inventory/InventoryView";
import { NoAccess } from "@/components/admin/ui";
import { categories } from "@/lib/catalog";
import { getDb } from "@/lib/db";
import { pageAccess } from "@/lib/page-auth";
import { listSuppliers } from "@/lib/server/suppliers";

export const metadata = { title: "Inventory" };

export default async function InventoryPage() {
  const { allowed } = await pageAccess("inventory.view");
  if (!allowed) return <NoAccess />;
  const db = await getDb();
  const [brands, suppliers] = await Promise.all([
    db.query<{ brand: string }>("select distinct brand from products where status <> 'archived' order by brand"),
    listSuppliers(db),
  ]);
  return (
    <Suspense>
      <InventoryView brands={brands.map((b) => b.brand)} categories={categories.map((c) => ({ slug: c.slug, name: c.name }))} suppliers={suppliers.map((s) => ({ id: s.id, name: s.name, phone: s.phone }))} />
    </Suspense>
  );
}
