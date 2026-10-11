import { json, readJson, staffRoute } from "@/lib/api";
import type { InvoiceReview } from "@/lib/invoice-types";
import { can } from "@/lib/permissions";
import { forbidden, notFound } from "@/lib/server/errors";
import { aiProvider } from "@/lib/server/invoice-extract";
import { confirmInvoice, discardInvoice, reviewWarnings, runExtraction, saveReview, type InvoiceImportRow } from "@/lib/server/invoices";
import { revalidateStore } from "@/lib/server/revalidate";
import { getSettings } from "@/lib/server/settings";
import { readPrivateFile } from "@/lib/server/storage";

type P = { id: string };

export const GET = staffRoute<P>("purchases.create", async (_req, { db, params }) => {
  const r = (await db.query<InvoiceImportRow>("select * from invoice_imports where id = $1", [params.id]))[0];
  if (!r) throw notFound("Invoice not found");
  const s = await getSettings(db);
  const p = aiProvider();
  const { file_path: _p, ...rest } = r;
  return json({
    invoice: rest,
    reviewWarnings: r.review ? reviewWarnings(r.review) : [],
    ai: p ? { label: p.label, external: p.external, allowed: !p.external || s.ai.allowExternalInvoiceAi } : null,
  });
});

/** Save staff corrections. */
export const PATCH = staffRoute<P>("purchases.create", async (req, { db, actor, params }) => {
  const body = await readJson<{ review: InvoiceReview }>(req);
  return json(await db.tx((q) => saveReview(q, actor, params.id, body.review)));
});

/**
 * { action: "extract", text?, mode? }  → run AI / text / manual extraction (no stock change)
 * { action: "confirm", overrideDuplicateReason? } → create purchase receipt & raise stock
 * { action: "discard" }
 */
export const POST = staffRoute<P>("purchases.create", async (req, { db, actor, params }) => {
  const body = await readJson<{ action: string; text?: string; mode?: "auto" | "text" | "manual"; overrideDuplicateReason?: string }>(req);
  if (body.action === "extract") {
    const r = (await db.query<{ file_path: string; mime: string }>("select file_path, mime from invoice_imports where id = $1", [params.id]))[0];
    if (!r) throw notFound("Invoice not found");
    const file = body.mode === "manual" ? null : { bytes: await readPrivateFile(r.file_path), mime: r.mime };
    const result = await runExtraction(db, actor, params.id, { text: body.text, file, mode: body.mode });
    return json(result);
  }
  if (body.action === "confirm") {
    if (!can(actor.role, "purchases.confirm")) throw forbidden();
    if (body.overrideDuplicateReason && !can(actor.role, "purchases.override_duplicate")) throw forbidden("Only the owner can receive the same invoice twice");
    const r = await confirmInvoice(db, actor, params.id, { overrideDuplicateReason: body.overrideDuplicateReason });
    revalidateStore();
    return json(r);
  }
  if (body.action === "discard") {
    await db.tx((q) => discardInvoice(q, actor, params.id));
    return json({ ok: true });
  }
  return json({ error: "Unknown action" }, 400);
});
