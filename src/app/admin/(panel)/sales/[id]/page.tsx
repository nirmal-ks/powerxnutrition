import { notFound } from "next/navigation";
import { SaleDetail } from "@/components/admin/sales/SaleDetail";
import { NoAccess } from "@/components/admin/ui";
import { getDb } from "@/lib/db";
import { pageAccess } from "@/lib/page-auth";
import { can } from "@/lib/permissions";
import { receiptPdfUrl, receiptUrl } from "@/lib/server/receipt-link";
import { whatsappCloudEnabled } from "@/lib/server/whatsapp-cloud";
import { getSale } from "@/lib/server/sales";

export const metadata = { title: "Bill" };

export default async function SalePage({ params }: { params: Promise<{ id: string }> }) {
  const { actor, allowed } = await pageAccess("sales.view");
  if (!allowed) return <NoAccess />;
  const sale = await getSale(await getDb(), decodeURIComponent((await params).id), { includeCost: can(actor.role, "reports.financial") });
  if (!sale) notFound();
  return (
    <SaleDetail
      sale={sale}
      receiptUrl={receiptUrl(sale.id)}
      pdfUrl={receiptPdfUrl(sale.id)}
      whatsappAuto={whatsappCloudEnabled()}
      canReturn={can(actor.role, "sales.return")}
      canVoid={can(actor.role, "sales.void")}
    />
  );
}
