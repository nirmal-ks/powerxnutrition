"use client";

import { createContext, useContext } from "react";
import { can, type Actor, type Permission } from "@/lib/permissions";

const Ctx = createContext<Actor | null>(null);

export function SessionProvider({ actor, children }: { actor: Actor; children: React.ReactNode }) {
  return <Ctx.Provider value={actor}>{children}</Ctx.Provider>;
}

export function useActor() {
  return useContext(Ctx)!;
}

/** UI-only convenience — the server enforces every permission again. */
export function useCan() {
  const a = useContext(Ctx);
  return (p: Permission) => can(a?.role, p);
}
