import { PosTerminal } from "@/components/admin/pos/PosTerminal";
import { NoAccess } from "@/components/admin/ui";
import { siteConfig } from "@/config/site";
import { getDb } from "@/lib/db";
import { pageAccess } from "@/lib/page-auth";
import { maxDiscountPct } from "@/lib/server/sales";
import { getSettings } from "@/lib/server/settings";
import { whatsappCloudEnabled } from "@/lib/server/whatsapp-cloud";

export const metadata = { title: "New bill" };

export default async function NewSalePage() {
  const { actor, allowed } = await pageAccess("sales.create");
  if (!allowed) return <NoAccess />;
  const s = await getSettings(await getDb());
  return (
    <PosTerminal
      config={{
        methods: (Object.keys(s.operations.paymentMethods) as ("cash" | "upi" | "card" | "other")[]).filter((m) => s.operations.paymentMethods[m]),
        maxDiscountPct: maxDiscountPct(actor, s),
        tax: { registered: s.business.gstRegistered, inclusive: s.business.pricesIncludeTax, roundToRupee: s.business.roundToRupee },
        allowNegative: s.operations.allowNegativeStock,
        upi: { id: siteConfig.upi.id, name: siteConfig.upi.name },
        shopName: s.business.tradeName,
        whatsappAuto: whatsappCloudEnabled(),
      }}
    />
  );
}
