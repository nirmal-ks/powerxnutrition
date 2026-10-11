import { SettingsView } from "@/components/admin/settings/SettingsView";
import { PageHeader } from "@/components/admin/ui";
import { dbKind, getDb } from "@/lib/db";
import { pageAccess } from "@/lib/page-auth";
import { can } from "@/lib/permissions";
import { googleConfigured } from "@/lib/server/images";
import { aiProvider } from "@/lib/server/invoice-extract";
import { razorpayEnabled } from "@/lib/server/razorpay";
import { getSettings } from "@/lib/server/settings";
import { listStaff } from "@/lib/server/staff";
import { storageKind } from "@/lib/server/storage";

export const metadata = { title: "Settings & staff" };

export default async function SettingsPage() {
  const { actor } = await pageAccess();
  const db = await getDb();
  const owner = can(actor.role, "settings.manage");
  const p = aiProvider();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={owner ? "Settings & staff" : "My account"} />
      <SettingsView
        actor={actor}
        settings={owner ? await getSettings(db) : null}
        staff={can(actor.role, "staff.manage") ? await listStaff(db) : []}
        integrations={
          owner
            ? {
                database: dbKind() === "postgres" ? "Cloud Postgres (DATABASE_URL)" : "Local PGlite (data/db)",
                storage: storageKind() === "supabase" ? "Supabase Storage" : "Local disk (data/uploads, data/private)",
                ai: p ? `${p.label}${p.external ? " — external service" : " — local"}` : null,
                googleImages: googleConfigured(),
                razorpay: razorpayEnabled(),
                razorpayWebhook: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET),
              }
            : null
        }
      />
    </div>
  );
}
