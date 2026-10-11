import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/admin/PrintButton";
import { Receipt } from "@/components/admin/Receipt";
import { getDb } from "@/lib/db";
import { receiptPdfUrl, verifyReceiptToken } from "@/lib/server/receipt-link";
import { getSale } from "@/lib/server/sales";

export const metadata: Metadata = { title: "Receipt", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Customer's digital receipt (link shared on WhatsApp). Requires the signed token in the link. */
export default async function PublicReceipt({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> }) {
  const { id } = await params;
  const { t } = await searchParams;
  if (!verifyReceiptToken(decodeURIComponent(id), t ?? "")) notFound();
  const sale = await getSale(await getDb(), decodeURIComponent(id));
  if (!sale) notFound();
  return (
    <main className="receipt-page relative z-[70] px-3 py-8">
      <Receipt sale={sale} />
      <div className="mx-auto mt-4 max-w-md print:hidden">
        <PrintButton pdfUrl={receiptPdfUrl(sale.id)} />
      </div>
    </main>
  );
}
