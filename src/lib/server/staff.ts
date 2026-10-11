import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { Queryable } from "@/lib/db/adapter";
import { newId } from "@/lib/db/ids";
import { isRole, type Actor, type Role } from "@/lib/permissions";
import { audit } from "./audit";
import { bad, conflict, forbidden, notFound } from "./errors";

/** The built-in owner account that logs in with ADMIN_PASSWORD (works before any staff exist). */
export const BUILTIN_OWNER_ID = "owner";

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [kind, salt, hash] = stored.split("$");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const got = scryptSync(password, salt, 32);
  const want = Buffer.from(hash, "hex");
  return got.length === want.length && timingSafeEqual(got, want);
}

export interface StaffRow {
  id: string;
  username: string;
  name: string;
  role: Role;
  active: boolean;
  session_version: number;
  phone: string | null;
  created_at: string;
}

export async function ensureBuiltinOwner(q: Queryable) {
  await q.query(
    `insert into staff (id, username, name, role, password_hash) values ($1, 'owner', 'Owner', 'owner', 'env:ADMIN_PASSWORD')
     on conflict (id) do nothing`,
    [BUILTIN_OWNER_ID],
  );
}

export async function findStaffByUsername(q: Queryable, username: string) {
  return (await q.query<StaffRow & { password_hash: string }>("select * from staff where lower(username) = lower($1)", [username]))[0] ?? null;
}

export async function getStaff(q: Queryable, id: string) {
  return (await q.query<StaffRow>("select id, username, name, role, active, session_version, phone, created_at from staff where id = $1", [id]))[0] ?? null;
}

export async function listStaff(q: Queryable) {
  return q.query<StaffRow>("select id, username, name, role, active, session_version, phone, created_at from staff order by active desc, role, name");
}

const USER_RE = /^[a-z0-9._-]{3,30}$/;

function checkPassword(pw: string) {
  if (pw.length < 8) throw bad("Password must be at least 8 characters");
  if (/^\d+$/.test(pw) && pw.length < 10) throw bad("Use letters too, or at least 10 digits");
}

export async function createStaff(q: Queryable, actor: Actor, input: { username: string; name: string; role: string; password: string; phone?: string }) {
  if (actor.role !== "owner") throw forbidden("Only the owner can add staff");
  const username = String(input.username ?? "").trim().toLowerCase();
  if (!USER_RE.test(username)) throw bad("Username: 3–30 letters, numbers, dot, dash or underscore (no spaces)");
  if (username === "owner") throw bad("“owner” is reserved for the main owner login");
  const name = String(input.name ?? "").trim().slice(0, 60);
  if (name.length < 2) throw bad("Enter the person's name");
  if (!isRole(input.role)) throw bad("Choose a role");
  checkPassword(String(input.password ?? ""));
  if (await findStaffByUsername(q, username)) throw conflict("That username is taken");
  const id = newId();
  await q.query("insert into staff (id, username, name, role, password_hash, phone) values ($1,$2,$3,$4,$5,$6)", [
    id,
    username,
    name,
    input.role,
    hashPassword(input.password),
    String(input.phone ?? "").replace(/\D/g, "").slice(-10) || null,
  ]);
  await audit(q, actor, "staff.created", { type: "staff", id }, `Added ${name} (@${username}) as ${input.role}`);
  return getStaff(q, id);
}

/** Role / active / password changes. Each one bumps session_version → existing logins are signed out. */
export async function updateStaff(q: Queryable, actor: Actor, id: string, patch: { name?: string; role?: string; active?: boolean; password?: string; phone?: string }) {
  if (actor.role !== "owner") throw forbidden("Only the owner can change staff accounts");
  const cur = await getStaff(q, id);
  if (!cur) throw notFound("Staff member not found");
  if (id === BUILTIN_OWNER_ID && (patch.role || patch.active === false || patch.password)) {
    throw bad("The main owner login is controlled by ADMIN_PASSWORD in the server settings");
  }
  const next = { ...cur };
  const changes: string[] = [];
  if (patch.name !== undefined && patch.name.trim() && patch.name.trim() !== cur.name) {
    next.name = patch.name.trim().slice(0, 60);
    changes.push("name");
  }
  if (patch.role !== undefined && patch.role !== cur.role) {
    if (!isRole(patch.role)) throw bad("Choose a role");
    next.role = patch.role;
    changes.push(`role ${cur.role}→${patch.role}`);
  }
  if (patch.active !== undefined && patch.active !== cur.active) {
    if (id === actor.id) throw bad("You can't deactivate your own account");
    next.active = patch.active;
    changes.push(patch.active ? "re-activated" : "deactivated");
  }
  if (cur.role === "owner" && (next.role !== "owner" || !next.active)) {
    const owners = await q.query("select 1 from staff where role = 'owner' and active and id <> $1", [id]);
    if (!owners.length) throw bad("Keep at least one active owner");
  }
  let hash: string | null = null;
  if (patch.password) {
    checkPassword(patch.password);
    hash = hashPassword(patch.password);
    changes.push("password reset");
  }
  if (patch.phone !== undefined) next.phone = String(patch.phone).replace(/\D/g, "").slice(-10) || null;
  const signOut = changes.some((c) => c.startsWith("role") || c === "deactivated" || c === "password reset");
  await q.query(
    `update staff set name=$2, role=$3, active=$4, phone=$5, password_hash=coalesce($6, password_hash),
       session_version = session_version + $7, updated_at=now() where id=$1`,
    [id, next.name, next.role, next.active, next.phone, hash, signOut ? 1 : 0],
  );
  if (changes.length) {
    await audit(q, actor, changes.some((c) => c.startsWith("role")) ? "staff.permission_changed" : "staff.updated", { type: "staff", id }, `${cur.name}: ${changes.join(", ")}`);
  }
  return getStaff(q, id);
}

/** Staff changing their own password. */
export async function changeOwnPassword(q: Queryable, actor: Actor, current: string, next: string) {
  if (actor.id === BUILTIN_OWNER_ID) throw bad("The main owner password is ADMIN_PASSWORD in the server settings");
  const row = (await q.query<{ password_hash: string }>("select password_hash from staff where id = $1", [actor.id]))[0];
  if (!row || !verifyPassword(current, row.password_hash)) throw bad("Current password is wrong");
  checkPassword(next);
  await q.query("update staff set password_hash = $2, session_version = session_version + 1, updated_at = now() where id = $1", [actor.id, hashPassword(next)]);
  await audit(q, actor, "staff.password_changed", { type: "staff", id: actor.id }, `${actor.name} changed their password`);
}
