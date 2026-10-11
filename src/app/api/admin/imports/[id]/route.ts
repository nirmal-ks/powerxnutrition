import { json, readJson, searchParams, staffRoute } from "@/lib/api";
import { can } from "@/lib/permissions";
import { forbidden } from "@/lib/server/errors";
import { toCsv } from "@/lib/server/reports";
import { revalidateStore } from "@/lib/server/revalidate";
import { confirmImport, discardImport, getImport, updateImportRows, type ImportRow } from "@/lib/server/stock-import";

type P = { id: string };

/** ?format=errors → downloadable CSV error report. */
export const GET = staffRoute<P>("purchases.create", async (req, { db, params }) => {
  const imp = await getImport(db, params.id);
  if (!imp) return json({ error: "Import not found" }, 404);
  if (searchParams(req).get("format") === "errors") {
    const rows = imp.rows
      .filter((r) => r.errors.length || r.warnings.length || r.action === "reject")
      .map((r) => ({ line: r.line, sku: r.sku, barcode: r.barcode, brand: r.brand, product: r.name, size: r.size, flavour: r.flavour, qty: r.qty, cost: r.cost, action: r.action, errors: r.errors.join(" | "), warnings: r.warnings.join(" | ") }));
    return new Response(toCsv(rows), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="import-errors-${imp.file_name.replace(/[^\w.-]/g, "_")}.csv"` },
    });
  }
  return json({ import: imp });
});

/** Save corrections from the review table (re-validated on the server). */
export const PATCH = staffRoute<P>("purchases.create", async (req, { db, actor, params }) => {
  const body = await readJson<{ rows: Partial<ImportRow>[]; supplierId?: string | null }>(req);
  const rows = await db.tx((q) => updateImportRows(q, actor, params.id, { rows: body.rows ?? [], supplierId: body.supplierId }));
  return json({ rows });
});

/** { action: "confirm", overrideDuplicateReason? } | { action: "discard" } */
export const POST = staffRoute<P>("purchases.create", async (req, { db, actor, params }) => {
  const body = await readJson<{ action: string; overrideDuplicateReason?: string }>(req);
  if (body.action === "discard") {
    await db.tx((q) => discardImport(q, actor, params.id));
    return json({ ok: true });
  }
  if (!can(actor.role, "purchases.confirm")) throw forbidden();
  if (body.overrideDuplicateReason && !can(actor.role, "purchases.override_duplicate")) throw forbidden("Only the owner can import the same invoice twice");
  const r = await confirmImport(db, actor, params.id, { overrideDuplicateReason: body.overrideDuplicateReason });
  revalidateStore();
  return json(r);
});
