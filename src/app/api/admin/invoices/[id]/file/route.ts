import { staffRoute } from "@/lib/api";
import { notFound } from "@/lib/server/errors";
import { readPrivateFile } from "@/lib/server/storage";

/** Streams the private invoice file to logged-in staff only (never a public URL). */
export const GET = staffRoute<{ id: string }>("purchases.create", async (_req, { db, params }) => {
  const r = (await db.query<{ file_path: string; mime: string; file_name: string }>("select file_path, mime, file_name from invoice_imports where id = $1", [params.id]))[0];
  if (!r) throw notFound("Invoice not found");
  const buf = await readPrivateFile(r.file_path);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": r.mime,
      "Content-Disposition": `inline; filename="${r.file_name.replace(/[^\w.-]/g, "_")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
