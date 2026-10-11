import { json, searchParams, staffRoute } from "@/lib/api";
import { createExpense, listExpenses } from "@/lib/server/expenses";
import { toCsv } from "@/lib/server/reports";
import { savePrivateFile, sniffType } from "@/lib/server/storage";

export const GET = staffRoute("expenses.manage", async (req, { db }) => {
  const sp = searchParams(req);
  const rows = await listExpenses(db, { from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined, category: sp.get("category") ?? undefined, includeVoided: sp.get("voided") === "1" });
  if (sp.get("format") === "csv") {
    return new Response(toCsv(rows.map(({ receipt_path, ...r }) => ({ ...r, has_receipt: Boolean(receipt_path) }))), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="expenses.csv"` },
    });
  }
  return json({ expenses: rows });
});

/** multipart form: date, category, amount, description, paymentMethod, receipt (optional image/PDF). */
export const POST = staffRoute("expenses.manage", async (req, { db, actor }) => {
  const form = await req.formData();
  let receiptPath: string | null = null;
  const file = form.get("receipt");
  if (file instanceof File && file.size > 0) {
    if (file.size > 5 * 1024 * 1024) return json({ error: "Receipt must be under 5 MB" }, 400);
    const bytes = Buffer.from(await file.arrayBuffer());
    const mime = sniffType(bytes);
    if (!mime) return json({ error: "Receipt must be a photo (JPG/PNG/WEBP) or PDF" }, 400);
    receiptPath = await savePrivateFile("receipts", file.name, mime, bytes);
  }
  const id = await db.tx((q) =>
    createExpense(q, actor, {
      date: String(form.get("date") ?? ""),
      category: String(form.get("category") ?? ""),
      amount: String(form.get("amount") ?? ""),
      description: String(form.get("description") ?? ""),
      paymentMethod: String(form.get("paymentMethod") ?? ""),
      receiptPath,
    }),
  );
  return json({ id }, 201);
});
