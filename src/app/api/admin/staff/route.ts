import { json, readJson, staffRoute } from "@/lib/api";
import { createStaff, listStaff } from "@/lib/server/staff";

export const GET = staffRoute("staff.manage", async (_req, { db }) => json({ staff: await listStaff(db) }));

export const POST = staffRoute("staff.manage", async (req, { db, actor }) => {
  const b = await readJson<{ username: string; name: string; role: string; password: string; phone?: string }>(req);
  return json({ staff: await db.tx((q) => createStaff(q, actor, b)) }, 201);
});
