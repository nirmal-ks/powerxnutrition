import { json, readJson, staffRoute } from "@/lib/api";
import { notFound } from "@/lib/server/errors";
import { voidExpense } from "@/lib/server/expenses";
import { readPrivateFile, sniffType } from "@/lib/server/storage";

type P = { id: string };

/** Receipt attachment (private). */
export const GET = staffRoute<P>("expenses.manage", async (_req, { db, params }) => {
  const r = (await db.query<{ receipt_path: string | null }>("select receipt_path from expenses where id = $1", [params.id]))[0];
  if (!r?.receipt_path) throw notFound("No receipt attached");
  const buf = await readPrivateFile(r.receipt_path);
  return new Response(new Uint8Array(buf), { headers: { "Content-Type": sniffType(buf) ?? "application/octet-stream", "Cache-Control": "private, no-store" } });
});

/** Void (never delete) with a reason. */
export const POST = staffRoute<P>("expenses.manage", async (req, { db, actor, params }) => {
  const b = await readJson<{ reason: string }>(req);
  await db.tx((q) => voidExpense(q, actor, params.id, b.reason));
  return json({ ok: true });
});
