import { allocate } from "./money";

/**
 * Bill calculator used for POS bills and online orders (and for the POS preview, but the server
 * always recomputes — browser totals are never trusted). Pure function, integer paise throughout.
 *
 * GST rules applied only when the owner has switched GST registration ON in Billing settings:
 *  - every line needs a GST rate set on its product (we never guess a rate);
 *  - intra-state → CGST + SGST (half each), inter-state → IGST;
 *  - "inclusive" prices: tax is extracted from the price; "exclusive": tax is added on top.
 * Not registered → no tax lines at all, document is a plain receipt (never a "tax invoice").
 */
export interface BillLineInput {
  key: string;
  name: string;
  qty: number;
  unitPrice: number; // paise
  gstRate: number | null; // percent, from the product
}

export interface TaxConfig {
  registered: boolean;
  inclusive: boolean;
  interState: boolean;
  /** GST rate on the delivery charge (null = delivery not taxed). Only used when registered. */
  deliveryRate?: number | null;
  roundToRupee?: boolean;
}

export interface BillLine {
  key: string;
  qty: number;
  unitPrice: number;
  gross: number;
  discount: number;
  taxable: number;
  taxRate: number;
  tax: number;
  total: number;
}

export interface Bill {
  lines: BillLine[];
  subtotal: number;
  discount: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  tax: number;
  delivery: number;
  deliveryTax: number;
  roundOff: number;
  total: number;
  documentType: "receipt" | "tax_invoice";
  taxMode: "none" | "inclusive" | "exclusive";
}

export class BillError extends Error {}

function splitTax(amount: number, rate: number, inclusive: boolean) {
  if (!rate) return { taxable: amount, tax: 0 };
  if (inclusive) {
    const tax = Math.round((amount * rate) / (100 + rate));
    return { taxable: amount - tax, tax };
  }
  return { taxable: amount, tax: Math.round((amount * rate) / 100) };
}

export function computeBill(lines: BillLineInput[], discountPaise: number, cfg: TaxConfig, deliveryPaise = 0): Bill {
  if (!lines.length) throw new BillError("Add at least one item");
  for (const l of lines) {
    if (!Number.isInteger(l.qty) || l.qty <= 0) throw new BillError(`Invalid quantity for ${l.name}`);
    if (!Number.isInteger(l.unitPrice) || l.unitPrice < 0) throw new BillError(`Invalid price for ${l.name}`);
  }
  if (cfg.registered) {
    const missing = lines.filter((l) => l.gstRate === null || l.gstRate === undefined || !Number.isFinite(l.gstRate));
    if (missing.length) {
      throw new BillError(
        `GST rate is not set for: ${missing.map((m) => m.name).join(", ")}. Set it in Products (HSN & GST) before billing — rates are never guessed.`,
      );
    }
  }

  const gross = lines.map((l) => l.qty * l.unitPrice);
  const subtotal = gross.reduce((s, v) => s + v, 0);
  const discount = Math.min(Math.max(0, Math.round(discountPaise)), subtotal);
  const lineDiscounts = allocate(discount, gross);

  const out: BillLine[] = lines.map((l, i) => {
    const net = gross[i] - lineDiscounts[i];
    const rate = cfg.registered ? Number(l.gstRate) : 0;
    const { taxable, tax } = cfg.registered ? splitTax(net, rate, cfg.inclusive) : { taxable: net, tax: 0 };
    return {
      key: l.key,
      qty: l.qty,
      unitPrice: l.unitPrice,
      gross: gross[i],
      discount: lineDiscounts[i],
      taxable,
      taxRate: rate,
      tax,
      total: taxable + tax,
    };
  });

  let deliveryTaxable = Math.max(0, Math.round(deliveryPaise));
  let deliveryTax = 0;
  if (cfg.registered && cfg.deliveryRate) {
    const s = splitTax(deliveryTaxable, cfg.deliveryRate, cfg.inclusive);
    deliveryTaxable = s.taxable;
    deliveryTax = s.tax;
  }

  const tax = out.reduce((s, l) => s + l.tax, 0) + deliveryTax;
  const taxable = out.reduce((s, l) => s + l.taxable, 0);
  let cgst = 0, sgst = 0, igst = 0;
  if (cfg.registered) {
    if (cfg.interState) igst = tax;
    else {
      cgst = Math.floor(tax / 2);
      sgst = tax - cgst;
    }
  }
  const exact = taxable + tax + deliveryTaxable;
  const total = cfg.roundToRupee === false ? exact : Math.round(exact / 100) * 100;

  return {
    lines: out,
    subtotal,
    discount,
    taxable,
    cgst,
    sgst,
    igst,
    tax,
    delivery: deliveryTaxable,
    deliveryTax,
    roundOff: total - exact,
    total,
    documentType: cfg.registered ? "tax_invoice" : "receipt",
    taxMode: cfg.registered ? (cfg.inclusive ? "inclusive" : "exclusive") : "none",
  };
}
