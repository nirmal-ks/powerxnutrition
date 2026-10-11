import { json, readJson, searchParams, staffRoute } from "@/lib/api";
import { can } from "@/lib/permissions";
import { receiptPdfUrl, receiptUrl } from "@/lib/server/receipt-link";
import { revalidateStore } from "@/lib/server/revalidate";
import { createPosSale, listSales, type PosSaleInput } from "@/lib/server/sales";

/** Sales history search (bill no, date, product, customer, payment method, channel). */
export const GET = staffRoute("sales.view", async (req, { db, actor }) => {
  const sp = searchParams(req);
  const rows = await listSales(db, {
    search: sp.get("q") ?? undefined,
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
    channel: sp.get("channel") ?? undefined,
    method: sp.get("method") ?? undefined,
    product: sp.get("product") ?? undefined,
    status: sp.get("status") ?? undefined,
    // cashiers see only their own bills
    cashierId: can(actor.role, "sales.return") ? sp.get("cashier") ?? undefined : actor.id,
    limit: Number(sp.get("limit")) || 50,
    offset: Number(sp.get("offset")) || 0,
  });
  return json({ sales: rows });
});

/** Completes a POS bill. Totals, taxes and discounts are computed on the server. */
export const POST = staffRoute("sales.create", async (req, { db, actor }) => {
  const body = await readJson<PosSaleInput>(req);
  const { sale, duplicate } = await createPosSale(db, actor, body);
  if (!duplicate) revalidateStore();
  return json({ sale, duplicate, receiptUrl: receiptUrl(sale.id), pdfUrl: receiptPdfUrl(sale.id) }, duplicate ? 200 : 201);
});
