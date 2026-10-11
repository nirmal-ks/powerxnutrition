import type { Queryable } from "@/lib/db/adapter";
import type { Actor } from "@/lib/permissions";
import { DEFAULT_SETTINGS, GSTIN_RE, type AiSettings, type AllSettings, type BusinessSettings, type OperationsSettings } from "@/lib/settings-types";
import { audit } from "./audit";
import { bad } from "./errors";

type Key = keyof AllSettings;

export async function getSettings(q: Queryable): Promise<AllSettings> {
  const rows = await q.query<{ key: string; value: unknown }>("select key, value from settings where key in ('business','operations','ai')");
  const out = structuredClone(DEFAULT_SETTINGS);
  for (const r of rows) {
    const k = r.key as Key;
    (out as Record<Key, unknown>)[k] = { ...DEFAULT_SETTINGS[k], ...(r.value as object) };
  }
  out.operations.paymentMethods = { ...DEFAULT_SETTINGS.operations.paymentMethods, ...out.operations.paymentMethods };
  return out;
}

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
const num = (v: unknown, min: number, max: number, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
};

function validateBusiness(raw: Partial<BusinessSettings>, cur: BusinessSettings): BusinessSettings {
  const next: BusinessSettings = {
    tradeName: str(raw.tradeName ?? cur.tradeName, 100) || cur.tradeName,
    legalName: str(raw.legalName ?? cur.legalName, 150),
    address: str(raw.address ?? cur.address, 400),
    state: str(raw.state ?? cur.state, 60),
    stateCode: str(raw.stateCode ?? cur.stateCode, 2).replace(/\D/g, ""),
    phone: str(raw.phone ?? cur.phone, 20),
    email: str(raw.email ?? cur.email, 120),
    gstRegistered: bool(raw.gstRegistered, cur.gstRegistered),
    gstin: str(raw.gstin ?? cur.gstin, 15).toUpperCase(),
    pricesIncludeTax: bool(raw.pricesIncludeTax, cur.pricesIncludeTax),
    deliveryGstRate:
      raw.deliveryGstRate === undefined
        ? cur.deliveryGstRate
        : raw.deliveryGstRate === null || String(raw.deliveryGstRate) === ""
          ? null
          : num(raw.deliveryGstRate, 0, 40, 0),
    roundToRupee: bool(raw.roundToRupee, cur.roundToRupee),
    billPrefix: (str(raw.billPrefix ?? cur.billPrefix, 6).toUpperCase().replace(/[^A-Z0-9]/g, "") || "PX"),
    receiptFooter: str(raw.receiptFooter ?? cur.receiptFooter, 300),
  };
  if (next.gstRegistered) {
    if (!GSTIN_RE.test(next.gstin)) throw bad("Enter your 15-character GSTIN exactly as on your GST certificate");
    if (!next.legalName) throw bad("Legal business name is required for GST tax invoices");
    if (!/^\d{2}$/.test(next.stateCode)) throw bad("Enter your 2-digit GST state code (first 2 digits of your GSTIN)");
    if (next.gstin.slice(0, 2) !== next.stateCode) throw bad("The state code must match the first 2 digits of your GSTIN");
  }
  return next;
}

function validateOperations(raw: Partial<OperationsSettings>, cur: OperationsSettings): OperationsSettings {
  const pm = (raw.paymentMethods ?? {}) as Partial<OperationsSettings["paymentMethods"]>;
  const next: OperationsSettings = {
    allowNegativeStock: bool(raw.allowNegativeStock, cur.allowNegativeStock),
    onlineStockStage: raw.onlineStockStage === "confirmed" || raw.onlineStockStage === "placed" ? raw.onlineStockStage : cur.onlineStockStage,
    cashierMaxDiscountPct: num(raw.cashierMaxDiscountPct, 0, 100, cur.cashierMaxDiscountPct),
    managerMaxDiscountPct: num(raw.managerMaxDiscountPct, 0, 100, cur.managerMaxDiscountPct),
    defaultMinStock: Math.round(num(raw.defaultMinStock, 0, 10000, cur.defaultMinStock)),
    expiryAlertDays: Math.round(num(raw.expiryAlertDays, 1, 730, cur.expiryAlertDays)),
    paymentMethods: {
      cash: bool(pm.cash, cur.paymentMethods.cash),
      upi: bool(pm.upi, cur.paymentMethods.upi),
      card: bool(pm.card, cur.paymentMethods.card),
      other: bool(pm.other, cur.paymentMethods.other),
    },
  };
  if (!Object.values(next.paymentMethods).some(Boolean)) throw bad("Keep at least one payment method switched on");
  return next;
}

function validateAi(raw: Partial<AiSettings>, cur: AiSettings): AiSettings {
  return {
    allowExternalInvoiceAi: bool(raw.allowExternalInvoiceAi, cur.allowExternalInvoiceAi),
    imageSearchEnabled: bool(raw.imageSearchEnabled, cur.imageSearchEnabled),
    aiImageCheck: bool(raw.aiImageCheck, cur.aiImageCheck),
  };
}

/** Saves one settings group with validation and an audit record showing what changed. */
export async function saveSettings<K extends Key>(q: Queryable, actor: Actor, key: K, raw: Partial<AllSettings[K]>) {
  const all = await getSettings(q);
  const cur = all[key];
  const next = (
    key === "business"
      ? validateBusiness(raw as Partial<BusinessSettings>, cur as BusinessSettings)
      : key === "operations"
        ? validateOperations(raw as Partial<OperationsSettings>, cur as OperationsSettings)
        : validateAi(raw as Partial<AiSettings>, cur as AiSettings)
  ) as AllSettings[K];

  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of Object.keys(next) as (keyof typeof next)[]) {
    if (JSON.stringify(next[k]) !== JSON.stringify(cur[k])) changes[String(k)] = { from: cur[k], to: next[k] };
  }
  if (!Object.keys(changes).length) return next;

  await q.query(
    `insert into settings (key, value, updated_at, updated_by) values ($1, $2, now(), $3)
     on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = excluded.updated_by`,
    [key, JSON.stringify(next), actor.name],
  );
  const taxKeys = ["gstRegistered", "gstin", "pricesIncludeTax", "deliveryGstRate", "billPrefix", "stateCode", "legalName"];
  const isTax = key === "business" && Object.keys(changes).some((c) => taxKeys.includes(c));
  await audit(q, actor, isTax ? "settings.tax_changed" : `settings.${key}_changed`, { type: "settings", id: key }, `Changed ${Object.keys(changes).join(", ")}`, changes);
  return next;
}
