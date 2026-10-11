/** Owner-controlled settings (stored in the `settings` table). Client-safe types + defaults. */
export interface BusinessSettings {
  tradeName: string;
  legalName: string;
  address: string;
  state: string;
  /** 2-digit GST state code, e.g. "33" for Tamil Nadu. Entered by the owner. */
  stateCode: string;
  phone: string;
  email: string;
  gstRegistered: boolean;
  /** Only when registered. Never pre-filled. */
  gstin: string;
  /** Selling prices already include GST (normal for retail in India). */
  pricesIncludeTax: boolean;
  /** GST % on delivery charges for online orders; null = not taxed. */
  deliveryGstRate: number | null;
  roundToRupee: boolean;
  /** Bill numbers look like PX/26-27/00001 (prefix / financial year / running number). */
  billPrefix: string;
  receiptFooter: string;
}

export interface OperationsSettings {
  allowNegativeStock: boolean;
  /** When online orders take stock out of inventory. "placed" prevents overselling (recommended). */
  onlineStockStage: "placed" | "confirmed";
  cashierMaxDiscountPct: number;
  managerMaxDiscountPct: number;
  defaultMinStock: number;
  expiryAlertDays: number;
  paymentMethods: { cash: boolean; upi: boolean; card: boolean; other: boolean };
}

export interface AiSettings {
  /** The business allows supplier invoices to be sent to the configured external AI service. */
  allowExternalInvoiceAi: boolean;
  /** Search configured image sources for candidate product photos. */
  imageSearchEnabled: boolean;
  /** Ask the AI to double-check that a candidate photo matches brand/size/flavour (advisory only). */
  aiImageCheck: boolean;
}

export interface AllSettings {
  business: BusinessSettings;
  operations: OperationsSettings;
  ai: AiSettings;
}

export const DEFAULT_SETTINGS: AllSettings = {
  business: {
    tradeName: "PowerX Nutrition",
    legalName: "",
    address: "No 45, Ground Floor, Shop No-10, Chennai – Thiruvallur High Road, Veppampattu, Tiruvallur, Tamil Nadu – 602024",
    state: "Tamil Nadu",
    stateCode: "",
    phone: "9710235320",
    email: "",
    gstRegistered: false,
    gstin: "",
    pricesIncludeTax: true,
    deliveryGstRate: null,
    roundToRupee: true,
    billPrefix: "PX",
    receiptFooter: "Thank you for shopping at PowerX Nutrition! 💪",
  },
  operations: {
    allowNegativeStock: false,
    onlineStockStage: "placed",
    cashierMaxDiscountPct: 5,
    managerMaxDiscountPct: 25,
    defaultMinStock: 2,
    expiryAlertDays: 60,
    paymentMethods: { cash: true, upi: true, card: true, other: false },
  },
  ai: {
    allowExternalInvoiceAi: false,
    imageSearchEnabled: true,
    aiImageCheck: false,
  },
};

/** GSTIN format: 2-digit state code + PAN (10) + entity + 'Z' + checksum. Format check only. */
export const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** Standard GST slabs (percent). Owner still chooses the right one per product. */
export const GST_RATES = [0, 0.25, 3, 5, 12, 18, 28, 40];
