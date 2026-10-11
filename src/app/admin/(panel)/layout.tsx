import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";
import { SessionProvider } from "@/components/admin/SessionContext";
import { getSession } from "@/lib/auth";
import { dbKind, getDb } from "@/lib/db";
import { can } from "@/lib/permissions";
import { pendingWork } from "@/lib/server/reports";
import { storageKind } from "@/lib/server/storage";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · PowerX Admin" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await getSession();
  if (!actor) redirect("/admin/login");
  const kind = dbKind();
  const readOnlyHost = Boolean(process.env.VERCEL) && (kind === "pglite" || storageKind() === "local");
  const p = await pendingWork(await getDb()).catch(() => null);
  const counts = {
    newOrders: can(actor.role, "orders.manage") ? (p?.new_orders ?? 0) : 0,
    images: can(actor.role, "images.review") ? (p?.images ?? 0) : 0,
    invoices: can(actor.role, "purchases.create") ? (p?.invoices ?? 0) : 0,
    drafts: can(actor.role, "purchases.create") ? (p?.drafts ?? 0) : 0,
  };

  return (
    <SessionProvider actor={actor}>
      <div className="theme-dark min-h-dvh bg-[#0b0b0d] lg:grid lg:grid-cols-[15.5rem_1fr]">
        <AdminNav actor={actor} storage={kind === "postgres" ? "Postgres (cloud)" : "Local Postgres (PGlite)"} counts={counts} />
        <div className="min-w-0">
          {readOnlyHost && (
            <div className="border-b border-gold/30 bg-gold/10 px-4 py-3 text-sm text-gold sm:px-8">
              ⚠ Vercel setup incomplete:{kind === "pglite" && " DATABASE_URL is missing, so bills & stock can't be saved permanently."}
              {storageKind() === "local" && " SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are missing, so photos & invoices can't be stored."} Add them in Vercel → Settings → Environment Variables and redeploy (run <code>npm run check-env -- --vercel --connect</code> to test).
            </div>
          )}
          <div className="mx-auto max-w-6xl px-3 py-5 sm:px-6 sm:py-8">{children}</div>
        </div>
      </div>
    </SessionProvider>
  );
}
