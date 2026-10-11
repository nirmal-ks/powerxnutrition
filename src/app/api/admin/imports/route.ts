import { json, staffRoute } from "@/lib/api";
import { createImportPreview, listImports } from "@/lib/server/stock-import";

export const GET = staffRoute("purchases.create", async (_req, { db }) => json({ imports: await listImports(db) }));

/** Upload → parse → validate → match → PREVIEW (no stock change). */
export const POST = staffRoute("purchases.create", async (req, { db, actor }) => {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "Choose a .xlsx or .csv file" }, 400);
  if (file.size > 5 * 1024 * 1024) return json({ error: "File must be under 5 MB" }, 400);
  if (!/\.(xlsx|csv|xls)$/i.test(file.name)) return json({ error: "Upload an Excel (.xlsx) or CSV file" }, 400);
  const supplierId = String(form.get("supplierId") ?? "") || null;
  const bytes = Buffer.from(await file.arrayBuffer());
  const result = await db.tx((q) => createImportPreview(q, actor, file.name, bytes, supplierId));
  return json(result, 201);
});
