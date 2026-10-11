import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/adapter";
import { checkInvoice, normaliseExtraction, parseInvoiceText } from "@/lib/server/invoice-extract";
import { confirmInvoice, registerUpload, runExtraction, saveReview } from "@/lib/server/invoices";
import { confirmPurchase, savePurchaseDraft } from "@/lib/server/purchases";
import { saveSettings } from "@/lib/server/settings";
import { createSupplier } from "@/lib/server/suppliers";
import { OWNER, STOCK, stockOf, testDb, variantId } from "./helpers/db";

let db: Db;
let whey1: string;
let supplierId: string;

const f = <T,>(value: T, confidence = 0.95) => ({ value, confidence });
const goodAi = {
  supplierName: f("Fitness Distributors"),
  supplierGstin: f("33AAAAA0000A1Z5"),
  invoiceNo: f("FD/1001"),
  invoiceDate: f("2026-10-01"),
  subtotal: f(14000),
  taxTotal: f(2520),
  total: f(16520),
  lines: [{ name: f("Gold Standard 100% Whey"), brand: f("Optimum Nutrition"), size: f("1 kg"), qty: f(5), unitPrice: f(2800), taxRate: f(18), lineTotal: f(14000), batchNo: f("B77"), expiryDate: f("2028-03-31") }],
};
const gemini = (payload: unknown) => (async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }), { status: 200 })) as unknown as typeof fetch;

async function upload(name = "inv.pdf") {
  return db.tx((q) => registerUpload(q, STOCK, { fileName: name, mime: "application/pdf", size: 100, storedPath: "local:invoices/x", hash: name }));
}

beforeAll(async () => {
  db = await testDb();
  whey1 = await variantId(db, "on-gold-whey", "1-kg");
  supplierId = (await db.tx((q) => createSupplier(q, OWNER, { name: "Fitness Distributors", gstin: "33AAAAA0000A1Z5" }))).id;
});
afterEach(() => {
  delete process.env.GEMINI_API_KEY;
});
afterAll(() => db.close());

describe("AI supplier invoice reading", () => {
  it("valid invoice: AI values are kept with confidence, product & supplier matched, NO stock change until confirm", async () => {
    process.env.GEMINI_API_KEY = "test";
    await db.tx((q) => saveSettings(q, OWNER, "ai", { allowExternalInvoiceAi: true }));
    const before = await stockOf(db, whey1);
    const { id } = await upload("valid.pdf");
    const r = await runExtraction(db, STOCK, id, { file: { bytes: Buffer.from("%PDF-"), mime: "application/pdf" } }, gemini(goodAi));
    expect(r.provider).toBe("gemini");
    expect(r.extracted.invoiceNo).toEqual({ value: "FD/1001", confidence: 0.95 });
    expect(r.review.supplierId).toBe(supplierId);
    expect(r.review.lines[0]).toMatchObject({ action: "existing", variantId: whey1, qty: 5, unitCost: 2800 });
    expect(r.warnings.filter((w) => w.level === "error")).toEqual([]);
    expect(await stockOf(db, whey1)).toBe(before);
    const c = await confirmInvoice(db, STOCK, id);
    expect(await stockOf(db, whey1)).toBe(before + 5);
    const again = await confirmInvoice(db, STOCK, id);
    expect(again.duplicate).toBe(true);
    expect(await stockOf(db, whey1)).toBe(before + 5);
    expect(c.purchaseId).toBeTruthy();
  });

  it("missing fields stay empty (never invented) and are flagged", () => {
    const inv = normaliseExtraction({ supplierName: { value: null, confidence: null }, lines: [{ name: f("Creatine"), qty: f(2) }] });
    expect(inv.invoiceNo.value).toBeNull();
    expect(inv.lines[0].unitPrice.value).toBeNull();
    const w = checkInvoice(inv).map((x) => x.message).join(" | ");
    expect(w).toMatch(/Invoice number not found/);
    expect(w).toMatch(/unit price missing/);
  });

  it("incorrect extraction (qty × price ≠ line amount) and low confidence are flagged, values unchanged", () => {
    const inv = normaliseExtraction({ ...goodAi, lines: [{ ...goodAi.lines[0], qty: f(6, 0.4) }] });
    const w = checkInvoice(inv);
    expect(w.some((x) => x.field === "lines[0].lineTotal" && x.level === "error")).toBe(true);
    expect(w.some((x) => x.field === "lines[0].qty" && /low confidence/.test(x.message))).toBe(true);
    expect(inv.lines[0].qty.value).toBe(6);
  });

  it("invoice total mismatch is flagged", () => {
    const inv = normaliseExtraction({ ...goodAi, total: f(20000) });
    expect(checkInvoice(inv).some((x) => x.field === "total" && x.level === "error")).toBe(true);
  });

  it("duplicate invoice: warned at extraction and blocked at confirm unless the owner overrides", async () => {
    process.env.GEMINI_API_KEY = "test";
    const { id } = await upload("dup.pdf");
    const r = await runExtraction(db, STOCK, id, { file: { bytes: Buffer.from("%PDF-"), mime: "application/pdf" } }, gemini(goodAi));
    expect(r.warnings[0].message).toMatch(/already received/);
    await expect(confirmInvoice(db, STOCK, id)).rejects.toThrow(/already received/);
    const before = await stockOf(db, whey1);
    await confirmInvoice(db, OWNER, id, { overrideDuplicateReason: "Two deliveries billed on one invoice" });
    expect(await stockOf(db, whey1)).toBe(before + 5);
  });

  it("does not send invoices to an external AI unless the owner allowed it — uses free text reading", async () => {
    process.env.GEMINI_API_KEY = "test";
    await db.tx((q) => saveSettings(q, OWNER, "ai", { allowExternalInvoiceAi: false }));
    const boom = (async () => { throw new Error("must not be called"); }) as unknown as typeof fetch;
    const { id } = await upload("private.pdf");
    const text = "Fitness Distributors\nGSTIN 33AAAAA0000A1Z5\nInvoice No: FD/2002\nDate: 05/10/2026\n1 ON Gold Standard Whey 1kg 2106 4 2800.00 11200.00\nGrand Total 11200.00";
    const r = await runExtraction(db, STOCK, id, { text, file: null }, boom);
    expect(r.provider).toBe("text");
    expect(r.extracted.invoiceNo.value).toBe("FD/2002");
    expect(r.extracted.lines[0].qty.value).toBe(4);
    expect(r.extracted.lines[0].qty.confidence).toBeLessThan(0.75); // always needs checking
  });

  it("manual fallback: no AI and no text → empty form staff can fill and confirm", async () => {
    const before = await stockOf(db, whey1);
    const { id } = await upload("manual.jpg");
    const r = await runExtraction(db, STOCK, id, { mode: "manual" });
    expect(r.provider).toBe("manual");
    expect(r.review.lines).toEqual([]);
    await db.tx((q) =>
      saveReview(q, STOCK, id, { ...r.review, supplierId, invoiceNo: "HAND-1", invoiceDate: "2026-10-09", invoiceTotal: 5600, lines: [{ action: "existing", variantId: whey1, newProduct: null, description: "typed", qty: 2, unitCost: 2800, taxRate: null, batchNo: "", mfgDate: "", expiryDate: "" }] }),
    );
    await confirmInvoice(db, STOCK, id);
    expect(await stockOf(db, whey1)).toBe(before + 2);
  });

  it("AI service down → falls back to text/manual instead of blocking", async () => {
    process.env.GEMINI_API_KEY = "test";
    await db.tx((q) => saveSettings(q, OWNER, "ai", { allowExternalInvoiceAi: true }));
    const down = (async () => new Response("quota", { status: 429 })) as unknown as typeof fetch;
    const { id } = await upload("down.pdf");
    const r = await runExtraction(db, STOCK, id, { file: { bytes: Buffer.from("%PDF-"), mime: "application/pdf" }, text: "Invoice No: Z-9\n" }, down);
    expect(r.provider).toBe("text");
    expect(r.warnings.some((w) => /AI reading failed/.test(w.message))).toBe(true);
  });

  it("parses common Indian invoice text without AI", () => {
    const inv = parseInvoiceText("ABC Nutrition Pvt Ltd\nTAX INVOICE\nInvoice No. ABC-77\nInvoice Date: 12-Sep-2026\n1 MuscleBlaze Creatine 250g 3 450.00 1350.00\nTotal 1350.00");
    expect(inv.invoiceNo.value).toBe("ABC-77");
    expect(inv.invoiceDate.value).toBe("2026-09-12");
    expect(inv.total.value).toBe(1350);
    expect(inv.lines).toHaveLength(1);
  });

  it("confirmed invoice purchase cannot be confirmed for a supplier draft twice", async () => {
    const d = await db.tx((q) => savePurchaseDraft(q, STOCK, { supplierId, supplierInvoiceNo: "X-1", lines: [{ variantId: whey1, qty: 1, unitCost: 1 }] }));
    await db.tx((q) => confirmPurchase(q, STOCK, d.id));
    const r = await db.tx((q) => confirmPurchase(q, STOCK, d.id));
    expect(r.duplicate).toBe(true);
  });
});
