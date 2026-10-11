import { BillingSettings } from "@/components/admin/settings/BillingSettings";
import { NoAccess, PageHeader } from "@/components/admin/ui";
import { getDb } from "@/lib/db";
import { pageAccess } from "@/lib/page-auth";
import { getSettings } from "@/lib/server/settings";

export const metadata = { title: "Billing & GST" };

export default async function BillingPage() {
  const { allowed } = await pageAccess("tax.manage");
  if (!allowed) return <NoAccess />;
  const s = await getSettings(await getDb());
  const missingRates = (await (await getDb()).query<{ n: number }>("select count(*)::int as n from products where status = 'published' and gst_rate is null"))[0].n;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Billing & GST" subtitle="Business details printed on receipts, bill numbering and GST. Nothing is assumed — GST stays OFF until you switch it on with your real GSTIN." />
      <BillingSettings initial={s.business} missingRates={missingRates} />
    </div>
  );
}
