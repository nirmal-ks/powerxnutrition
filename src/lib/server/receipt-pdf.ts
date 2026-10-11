import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import type { SaleView } from "./sales";

/**
 * Bill / GST tax invoice as a PDF (A5-ish receipt width so it reads well on a phone).
 * Standard PDF fonts can't draw "₹", so amounts are written as "Rs.".
 */
const METHOD: Record<string, string> = { cash: "Cash", upi: "UPI", card: "Card", other: "Other", cod: "Cash on delivery", razorpay: "Online (Razorpay)" };
const STATUS: Record<string, string> = { received: "Received", verified: "Verified by gateway", pending: "Pending", verifying: "Being verified", failed: "Failed", refunded: "Refunded" };

const rs = (n: number) => `Rs. ${(Math.round(n * 100) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmt = (iso: string) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
/** Keep only characters the standard (WinAnsi) font can draw. */
const safe = (s: string) => String(s ?? "").replace(/₹/g, "Rs.").replace(/[–—]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/·/g, "-").replace(/[^\x20-\x7E\xA0-\xFF]/g, "");

export async function buildReceiptPdf(sale: SaleView): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const b = (sale.business ?? {}) as Record<string, string>;
  const isTax = sale.document_type === "tax_invoice";
  doc.setTitle(`${isTax ? "Tax Invoice" : "Receipt"} ${sale.bill_no}`);
  doc.setAuthor(b.tradeName || "PowerX Nutrition");

  const W = 420; // A5
  const H = 595;
  const M = 24;
  let page: PDFPage = doc.addPage([W, H]);
  let y = H - M;

  const ensure = (h: number) => {
    if (y - h < M) {
      page = doc.addPage([W, H]);
      y = H - M;
    }
  };
  const text = (s: string, x: number, size = 9, f: PDFFont = font, color = rgb(0, 0, 0)) => page.drawText(safe(s), { x, y, size, font: f, color });
  const right = (s: string, xRight: number, size = 9, f: PDFFont = font) => text(s, xRight - f.widthOfTextAtSize(safe(s), size), size, f);
  const center = (s: string, size = 9, f: PDFFont = font) => text(s, (W - f.widthOfTextAtSize(safe(s), size)) / 2, size, f);
  const wrap = (s: string, width: number, size: number, f: PDFFont = font) => {
    const words = safe(s).split(/\s+/);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const t = cur ? `${cur} ${w}` : w;
      if (f.widthOfTextAtSize(t, size) > width && cur) {
        lines.push(cur);
        cur = w;
      } else cur = t;
    }
    if (cur) lines.push(cur);
    return lines;
  };
  const line = (dash = true) => {
    page.drawLine({ start: { x: M, y: y + 3 }, end: { x: W - M, y: y + 3 }, thickness: 0.6, color: rgb(0.2, 0.2, 0.2), dashArray: dash ? [3, 2] : undefined });
    y -= 8;
  };
  const row = (label: string, value: string, f: PDFFont = font, size = 9) => {
    ensure(14);
    text(label, M, size, f);
    right(value, W - M, size, f);
    y -= size + 4;
  };

  // header
  center(b.tradeName || "PowerX Nutrition", 15, bold);
  y -= 18;
  if (isTax && b.legalName && b.legalName !== b.tradeName) {
    center(b.legalName, 9);
    y -= 12;
  }
  for (const l of wrap(b.address ?? "", W - 2 * M, 8)) {
    center(l, 8);
    y -= 10;
  }
  if (b.phone) {
    center(`Ph: ${b.phone}${b.email ? `  |  ${b.email}` : ""}`, 8);
    y -= 10;
  }
  if (isTax && b.gstin) {
    center(`GSTIN: ${b.gstin}`, 9, bold);
    y -= 12;
  }
  y -= 2;
  line(false);
  center(`${isTax ? "TAX INVOICE" : "RECEIPT"}${sale.status === "cancelled" ? " - CANCELLED" : ""}`, 11, bold);
  y -= 12;
  line(false);

  text(`Bill: ${sale.bill_no}`, M, 9, bold);
  right(fmt(sale.offline_created_at ?? sale.created_at), W - M, 9);
  y -= 13;
  text(sale.channel === "ONLINE" ? `Online order ${sale.order_id ?? ""}` : `Cashier: ${sale.cashier_name}`, M, 8);
  if (isTax) right(`Place of supply: ${sale.place_of_supply}`, W - M, 8);
  y -= 11;
  if (sale.customer_name || sale.customer_phone) {
    text(`Customer: ${[sale.customer_name, sale.customer_phone].filter(Boolean).join("  |  ")}`, M, 8);
    y -= 11;
  }
  y -= 2;
  line();

  // items
  const cQty = W - M - 150;
  const cRate = W - M - 75;
  text("Item", M, 8, bold);
  right("Qty", cQty, 8, bold);
  right("Rate", cRate, 8, bold);
  right("Amount", W - M, 8, bold);
  y -= 12;
  for (const i of sale.items) {
    const name = wrap(`${i.product_name} (${i.variant_label})`, cQty - M - 30, 9);
    ensure(12 * name.length + 14);
    text(name[0], M, 9);
    right(String(i.qty), cQty, 9);
    right(rs(i.unit_price), cRate, 9);
    right(rs(i.unit_price * i.qty), W - M, 9);
    y -= 12;
    for (const l of name.slice(1)) {
      text(l, M, 9);
      y -= 12;
    }
    const extra = [isTax ? `HSN ${i.hsn || "-"}  |  GST ${i.tax_rate}%` : "", i.returned_qty ? `Returned: ${i.returned_qty}` : ""].filter(Boolean).join("   ");
    if (extra) {
      text(extra, M + 6, 7, font, rgb(0.3, 0.3, 0.3));
      y -= 10;
    }
  }
  y -= 2;
  line();

  // totals
  row("Subtotal", rs(sale.subtotal));
  if (sale.discount > 0) row("Discount", `- ${rs(sale.discount)}`);
  if (sale.delivery > 0) row("Delivery", rs(sale.delivery));
  if (isTax) {
    row(`Taxable value${sale.tax_mode === "inclusive" ? " (prices incl. GST)" : ""}`, rs(sale.taxable_value + sale.delivery));
    if (sale.igst > 0) row("IGST", rs(sale.igst));
    else {
      row("CGST", rs(sale.cgst));
      row("SGST", rs(sale.sgst));
    }
  }
  if (sale.round_off !== 0) row("Round off", rs(sale.round_off));
  y -= 2;
  line(false);
  row("TOTAL", rs(sale.total), bold, 12);
  y -= 2;
  line();

  // payments
  for (const p of sale.payments.filter((x) => x.direction === "in")) {
    ensure(12);
    text(`Paid by ${METHOD[p.method] ?? p.method}: ${rs(p.amount)} - ${STATUS[p.status] ?? p.status}${p.reference ? `  |  Ref ${p.reference}` : ""}`, M, 8);
    y -= 11;
  }
  for (const p of sale.payments.filter((x) => x.direction === "out")) {
    ensure(12);
    text(`Refunded ${rs(p.amount)} (${METHOD[p.method] ?? p.method})`, M, 8, bold);
    y -= 11;
  }
  for (const r of sale.returns) {
    ensure(12);
    text(`${r.kind === "void" ? "Cancelled" : "Return"} ${r.return_no}: ${r.reason}`, M, 8);
    y -= 11;
  }
  y -= 6;
  if (!isTax) {
    ensure(12);
    center("This is a sales receipt, not a GST tax invoice.", 7);
    y -= 11;
  }
  if (b.footer) {
    for (const l of wrap(b.footer, W - 2 * M, 9)) {
      ensure(12);
      center(l, 9, bold);
      y -= 12;
    }
  }
  return doc.save();
}
