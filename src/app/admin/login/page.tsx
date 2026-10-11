import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/LoginForm";
import { adminConfigured, isAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Admin Login", robots: { index: false, follow: false } };

export default async function AdminLoginPage() {
  if (await isAdmin()) redirect("/admin");
  return (
    <div className="theme-dark relative flex min-h-dvh bg-ink items-center justify-center overflow-hidden px-4">
      <div className="bg-grid absolute inset-0" />
      <div className="absolute left-1/2 top-1/3 h-80 w-80 -translate-x-1/2 rounded-full bg-blood/25 blur-[120px]" />
      <div className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-coal/90 p-8 shadow-2xl backdrop-blur">
        <p className="font-display text-3xl italic">
          POWER<span className="text-blood">X</span> <span className="not-italic text-gold">ADMIN</span>
        </p>
        <p className="mt-1 text-sm text-smoke">Billing, stock, orders & reports — for owner and staff.</p>
        {adminConfigured() ? (
          <LoginForm />
        ) : (
          <p className="mt-6 rounded-xl border border-gold/30 bg-gold/10 p-4 text-sm text-gold">
            Set <code>ADMIN_PASSWORD</code> and <code>ADMIN_SESSION_SECRET</code> in your environment variables (.env.local locally, or Vercel project settings), then restart.
          </p>
        )}
      </div>
    </div>
  );
}
