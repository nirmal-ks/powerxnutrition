import { json, readJson, staffRoute } from "@/lib/api";
import { can } from "@/lib/permissions";
import { receiptUrl } from "@/lib/server/receipt-link";
import { revalidateStore } from "@/lib/server/revalidate";
import { getSale, returnSale, voidSale, type ReturnInput } from "@/lib/server/sales";

type P = { id: string };

export const GET = staffRoute<P>("sales.view", async (_req, { db, actor, params }) => {
  const sale = await getSale(db, params.id, { includeCost: can(actor.role, "reports.financial") });
  if (!sale) return json({ error: "Bill not found" }, 404);
  return json({ sale, receiptUrl: receiptUrl(sale.id) });
});

/** Returns (partial) or cancellation of a bill — authorised roles only, always audited. */
export const POST = staffRoute<P>(["sales.return", "sales.void"], async (req, { db, actor, params }) => {
  const body = await readJson<ReturnInput & { action: "return" | "void" }>(req);
  const result =
    body.action === "void"
      ? await db.tx((q) => voidSale(q, actor, params.id, body.reason, body.refundMethod ?? "cash", "CANCELLATION"))
      : await db.tx((q) => returnSale(q, actor, params.id, body));
  revalidateStore();
  return json({ ...result, sale: await getSale(db, params.id) });
});
