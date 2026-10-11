import { ProductForm } from "@/components/admin/ProductForm";
import { NoAccess, PageHeader } from "@/components/admin/ui";
import { pageAccess } from "@/lib/page-auth";
import { supplierOptions } from "@/lib/server/page-data";

export const metadata = { title: "Add product" };

export default async function NewProductPage() {
  const { allowed } = await pageAccess("products.edit");
  if (!allowed) return <NoAccess />;
  return (
    <div>
      <PageHeader title="Add product" back={{ href: "/admin/products", label: "Products" }} subtitle="Tip: products also get created automatically when you receive a new item through a purchase, Excel import or invoice scan." />
      <ProductForm suppliers={await supplierOptions()} />
    </div>
  );
}
