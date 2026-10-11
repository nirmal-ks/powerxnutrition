import "server-only";
import { NextResponse } from "next/server";
import { sessionFromRequest } from "./auth";
import { getDb, type Db } from "./db";
import { can, type Actor, type Permission } from "./permissions";
import { StoreError } from "./store";

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

export function errorResponse(e: unknown) {
  if (e instanceof StoreError) return json({ error: e.message, ...(e.extra ?? {}) }, e.status);
  console.error(e);
  return json({ error: "Something went wrong. Please try again." }, 500);
}

export interface RouteCtx<P> {
  actor: Actor;
  db: Db;
  params: P;
}

/**
 * Wraps a staff API route: requires a valid login AND the given permission (checked on the
 * server — the UI hiding a button is never the security boundary), then converts errors to JSON.
 */
export function staffRoute<P = Record<string, string>>(perm: Permission | Permission[] | null, handler: (req: Request, ctx: RouteCtx<P>) => Promise<Response>) {
  return async (req: Request, ctx?: { params?: Promise<P> }) => {
    try {
      const actor = await sessionFromRequest(req);
      if (!actor) return json({ error: "Not logged in" }, 401);
      const perms = perm === null ? [] : Array.isArray(perm) ? perm : [perm];
      if (perms.length && !perms.some((p) => can(actor.role, p))) {
        return json({ error: "You don't have permission to do that. Ask the owner." }, 403);
      }
      const db = await getDb();
      const params = (ctx?.params ? await ctx.params : {}) as P;
      return await handler(req, { actor, db, params });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new StoreError("Invalid request body", 400);
  }
}

export const searchParams = (req: Request) => new URL(req.url).searchParams;
