import { getDb } from "@/lib/db";
import { buildReceiptPdf } from "@/lib/server/receipt-pdf";
import { verifyReceiptToken } from "@/lib/server/receipt-link";
import { getSale } from "@/lib/server/sales";

/** Bill PDF for the customer (link sent on WhatsApp). Requires the signed token in the link. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = decodeURIComponent((await ctx.params).id);
  const t = new URL(req.url).searchParams.get("t") ?? "";
  if (!verifyReceiptToken(id, t)) return new Response("Not found", { status: 404 });
  const sale = await getSale(await getDb(), id);
  if (!sale) return new Response("Not found", { status: 404 });
  const pdf = await buildReceiptPdf(sale);
  const name = `${sale.bill_no.replace(/[^\w-]+/g, "-")}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
