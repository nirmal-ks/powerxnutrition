import { notFound } from "next/navigation";
import { ProductForm } from "@/components/admin/ProductForm";
import { NoAccess, PageHeader } from "@/components/admin/ui";
import { getDb } from "@/lib/db";
import { pageAccess } from "@/lib/page-auth";
import { can } from "@/lib/permissions";
import { supplierOptions } from "@/lib/server/page-data";
import { getProductAdmin } from "@/lib/server/products";

export const metadata = { title: "Edit product" };

export default async function EditProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { actor, allowed } = await pageAccess("products.edit");
  if (!allowed) return <NoAccess />;
  const product = await getProductAdmin(await getDb(), (await params).slug, can(actor.role, "products.cost"));
  if (!product) notFound();
  return (
    <div>
      <PageHeader title="Edit product" back={{ href: "/admin/products", label: "Products" }} />
      <ProductForm product={product} suppliers={await supplierOptions()} />
    </div>
  );
}
