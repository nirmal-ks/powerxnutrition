/** Shapes for AI / OCR supplier-invoice extraction (client-safe). */

/** Every extracted value keeps the extractor's confidence (0–1). null value = not found on the invoice. */
export interface Field<T> {
  value: T | null;
  confidence: number | null;
}

export interface ExtractedLine {
  name: Field<string>;
  brand: Field<string>;
  sku: Field<string>;
  barcode: Field<string>;
  size: Field<string>;
  flavour: Field<string>;
  hsn: Field<string>;
  qty: Field<number>;
  unitPrice: Field<number>;
  discount: Field<number>;
  taxRate: Field<number>;
  taxAmount: Field<number>;
  lineTotal: Field<number>;
  batchNo: Field<string>;
  mfgDate: Field<string>;
  expiryDate: Field<string>;
}

export interface ExtractedInvoice {
  supplierName: Field<string>;
  supplierPhone: Field<string>;
  supplierEmail: Field<string>;
  supplierGstin: Field<string>;
  supplierAddress: Field<string>;
  invoiceNo: Field<string>;
  invoiceDate: Field<string>;
  subtotal: Field<number>;
  discountTotal: Field<number>;
  taxTotal: Field<number>;
  total: Field<number>;
  lines: ExtractedLine[];
}

export interface InvoiceWarning {
  level: "error" | "warn" | "info";
  field: string; // e.g. "total", "lines[2].qty"
  message: string;
}

/** Staff-reviewed version that becomes a purchase on confirmation. */
export interface InvoiceReview {
  supplierId: string | null;
  invoiceNo: string;
  invoiceDate: string;
  discountTotal: number;
  otherCharges: number;
  notes: string;
  /** Total printed on the invoice, used to check the reviewed lines add up. */
  invoiceTotal: number | null;
  lines: {
    action: "existing" | "new" | "skip";
    variantId: string | null;
    newProduct: {
      name: string;
      brand: string;
      category: string;
      label: string;
      flavour: string;
      sku: string;
      barcode: string;
      price: number;
      mrp: number;
      gstRate: number | null;
      hsn: string;
    } | null;
    description: string;
    qty: number;
    unitCost: number;
    taxRate: number | null;
    batchNo: string;
    mfgDate: string;
    expiryDate: string;
    candidates?: { variantId: string; label: string; score: number; reasons: string[] }[];
  }[];
}

export const LOW_CONFIDENCE = 0.75;

export const emptyField = <T>(): Field<T> => ({ value: null, confidence: null });

export function emptyLine(): ExtractedLine {
  return {
    name: emptyField(), brand: emptyField(), sku: emptyField(), barcode: emptyField(), size: emptyField(), flavour: emptyField(), hsn: emptyField(),
    qty: emptyField(), unitPrice: emptyField(), discount: emptyField(), taxRate: emptyField(), taxAmount: emptyField(), lineTotal: emptyField(),
    batchNo: emptyField(), mfgDate: emptyField(), expiryDate: emptyField(),
  };
}

export function emptyInvoice(): ExtractedInvoice {
  return {
    supplierName: emptyField(), supplierPhone: emptyField(), supplierEmail: emptyField(), supplierGstin: emptyField(), supplierAddress: emptyField(),
    invoiceNo: emptyField(), invoiceDate: emptyField(), subtotal: emptyField(), discountTotal: emptyField(), taxTotal: emptyField(), total: emptyField(),
    lines: [],
  };
}
