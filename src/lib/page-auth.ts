import "server-only";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can, type Actor, type Permission } from "@/lib/permissions";

/** For admin pages: returns the logged-in staff member and whether they may see this page. */
export async function pageAccess(perm?: Permission | Permission[]): Promise<{ actor: Actor; allowed: boolean }> {
  const actor = await getSession();
  if (!actor) redirect("/admin/login");
  const perms = perm ? (Array.isArray(perm) ? perm : [perm]) : [];
  return { actor, allowed: !perms.length || perms.some((p) => can(actor.role, p)) };
}
