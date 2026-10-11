import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import type { Actor } from "@/lib/permissions";
import { BUILTIN_OWNER_ID, ensureBuiltinOwner, findStaffByUsername, getStaff, verifyPassword } from "@/lib/server/staff";

/**
 * Staff login with roles.
 *  - The owner can always log in with username "owner" (or blank) + ADMIN_PASSWORD.
 *  - Other staff get their own username/password (Settings → Staff), each with a role.
 * Session = signed, httpOnly cookie holding {staff id, session version, expiry}. Every request
 * re-checks the staff row, so deactivating someone or changing their role signs them out at once.
 */
export const ADMIN_COOKIE = "px_admin";
const SESSION_DAYS = 7;

const secret = () => process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || "";
const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

const safeEqual = (a: string, b: string) => {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
};

export const adminConfigured = () => Boolean(process.env.ADMIN_PASSWORD);

export function checkOwnerPassword(password: string) {
  const expected = process.env.ADMIN_PASSWORD;
  return Boolean(expected) && safeEqual(password, expected!);
}

export function createSessionToken(staffId: string, version: number) {
  const payload = Buffer.from(JSON.stringify({ u: staffId, v: version, e: Date.now() + SESSION_DAYS * 86400_000 })).toString("base64url");
  return { token: `${payload}.${sign(payload)}`, maxAge: SESSION_DAYS * 86400 };
}

export function readSessionToken(token: string | undefined): { u: string; v: number } | null {
  if (!token || !secret()) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig || !safeEqual(sig, sign(payload))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { u: string; v: number; e: number };
    if (!data.u || data.e < Date.now()) return null;
    return { u: data.u, v: data.v };
  } catch {
    return null;
  }
}

async function actorFromToken(token: string | undefined): Promise<Actor | null> {
  const data = readSessionToken(token);
  if (!data) return null;
  const db = await getDb();
  const staff = await getStaff(db, data.u);
  if (!staff || !staff.active || staff.session_version !== data.v) return null;
  return { id: staff.id, name: staff.name, role: staff.role };
}

/** Logged-in staff member for server components / pages (null when signed out). */
export async function getSession(): Promise<Actor | null> {
  const jar = await cookies();
  return actorFromToken(jar.get(ADMIN_COOKIE)?.value);
}

/** Same, but from a Request's Cookie header (route handlers; also usable in tests). */
export async function sessionFromRequest(req: Request): Promise<Actor | null> {
  const cookie = req.headers.get("cookie") ?? "";
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${ADMIN_COOKIE}=([^;]+)`));
  return actorFromToken(m ? decodeURIComponent(m[1]) : undefined);
}

/** Backwards-compatible: any logged-in staff member. */
export async function isAdmin() {
  return Boolean(await getSession());
}

// Simple in-memory brute-force brake (per server instance).
const attempts = new Map<string, { n: number; until: number }>();
export function loginThrottle(key: string) {
  const now = Date.now();
  const a = attempts.get(key);
  if (a && a.until > now && a.n >= 8) return Math.ceil((a.until - now) / 1000);
  return 0;
}
function noteFailure(key: string) {
  const now = Date.now();
  const a = attempts.get(key);
  attempts.set(key, a && a.until > now ? { n: a.n + 1, until: a.until } : { n: 1, until: now + 10 * 60_000 });
}

/** Verifies credentials. Returns the session token on success. */
export async function login(username: string, password: string, ip: string) {
  const user = username.trim().toLowerCase();
  const key = `${ip}|${user}`;
  const wait = loginThrottle(key);
  if (wait) return { error: `Too many attempts. Try again in ${Math.ceil(wait / 60)} minute(s).` } as const;
  const db = await getDb();
  if (!user || user === "owner" || user === "admin") {
    if (!checkOwnerPassword(password)) {
      noteFailure(key);
      return { error: "Wrong username or password" } as const;
    }
    await ensureBuiltinOwner(db);
    const owner = await getStaff(db, BUILTIN_OWNER_ID);
    return { ...createSessionToken(BUILTIN_OWNER_ID, owner!.session_version), name: owner!.name } as const;
  }
  const staff = await findStaffByUsername(db, user);
  if (!staff || !staff.active || !verifyPassword(password, staff.password_hash)) {
    noteFailure(key);
    return { error: "Wrong username or password" } as const;
  }
  attempts.delete(key);
  return { ...createSessionToken(staff.id, staff.session_version), name: staff.name } as const;
}
