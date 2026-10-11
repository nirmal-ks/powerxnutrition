import { json, readJson, staffRoute } from "@/lib/api";
import { changeOwnPassword, updateStaff } from "@/lib/server/staff";

type P = { id: string };

/** id = "me" → change your own password { current, next }. Otherwise owner edits a staff account. */
export const PATCH = staffRoute<P>(null, async (req, { db, actor, params }) => {
  const b = await readJson<{ name?: string; role?: string; active?: boolean; password?: string; phone?: string; current?: string; next?: string }>(req);
  if (params.id === "me") {
    await db.tx((q) => changeOwnPassword(q, actor, String(b.current ?? ""), String(b.next ?? "")));
    return json({ ok: true });
  }
  return json({ staff: await db.tx((q) => updateStaff(q, actor, params.id, b)) });
});
