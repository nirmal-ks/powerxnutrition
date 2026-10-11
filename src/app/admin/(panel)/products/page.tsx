import Link from "next/link";
import { Suspense } from "react";
import { ProductsManager } from "@/components/admin/ProductsManager";
import { NoAccess, PageHeader } from "@/components/admin/ui";
import { PlusIcon } from "@/components/ui/Icons";
import { getDb } from "@/lib/db";
import { pageAccess } from "@/lib/page-auth";
import { can } from "@/lib/permissions";
import { listProducts } from "@/lib/server/products";

export const metadata = { title: "Products" };

export default async function AdminProductsPage() {
  const { actor, allowed } = await pageAccess("products.view");
  if (!allowed) return <NoAccess />;
  const db = await getDb();
  const products = await listProducts(db, { includeArchived: true, includeCost: can(actor.role, "products.cost") });
  // admin list needs the raw image even when not yet approved
  const raw = await db.query<{ slug: string; image: string }>("select slug, image from products");
  const img = new Map(raw.map((r) => [r.slug, r.image]));
  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="Prices, sizes, flavours, SKUs & publication. Stock changes only through sales, purchases and adjustments."
        actions={can(actor.role, "products.edit") ? <Link href="/admin/products/new" className="btn btn-red"><PlusIcon size={16} /> Add product</Link> : null}
      />
      <Suspense>
        <ProductsManager products={products.map((p) => ({ ...p, image: img.get(p.slug) ?? p.image }))} />
      </Suspense>
    </div>
  );
}
