import { json, staffRoute } from "@/lib/api";
import { INVOICE_TYPES, listInvoiceImports, MAX_INVOICE_BYTES, registerUpload } from "@/lib/server/invoices";
import { savePrivateFile, sha256, sniffType } from "@/lib/server/storage";

export const GET = staffRoute("purchases.create", async (_req, { db }) => json({ invoices: await listInvoiceImports(db) }));

/** Upload a supplier invoice (PDF/JPG/PNG/WEBP, ≤10 MB) into PRIVATE storage. Does not touch stock. */
export const POST = staffRoute("purchases.create", async (req, { db, actor }) => {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "Choose the invoice file (PDF or photo)" }, 400);
  if (file.size > MAX_INVOICE_BYTES) return json({ error: "File must be under 10 MB" }, 400);
  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = sniffType(bytes);
  if (!mime || !INVOICE_TYPES.includes(mime)) return json({ error: "Only PDF, JPG, PNG or WEBP invoices are accepted" }, 400);
  const storedPath = await savePrivateFile("invoices", file.name, mime, bytes);
  const r = await db.tx((q) => registerUpload(q, actor, { fileName: file.name, mime, size: bytes.length, storedPath, hash: sha256(bytes) }));
  return json(r, 201);
});
