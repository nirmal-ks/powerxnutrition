import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/adapter";
import { createExpense, voidExpense } from "@/lib/server/expenses";
import { createOrder, updateOrder } from "@/lib/server/orders";
import { confirmPurchase, savePurchaseDraft } from "@/lib/server/purchases";
import { collections, productSales, salesSummary, stockValuation, todayIST } from "@/lib/server/reports";
import { createPosSale, returnSale } from "@/lib/server/sales";
import { createSupplier } from "@/lib/server/suppliers";
import { computeBill } from "@/lib/tax";
import { allocate } from "@/lib/money";
import { CASHIER, MANAGER, OWNER, STOCK, testDb, txnId, variantId } from "./helpers/db";

let db: Db;
let whey1: string;
let creatine: string;
const today = todayIST();
const P = { from: today, to: today };

beforeAll(async () => {
  db = await testDb();
  whey1 = await variantId(db, "on-gold-whey", "1-kg");
  creatine = await variantId(db, "mb-creatine", "250-g");
  const sup = await db.tx((q) => createSupplier(q, OWNER, { name: "Report Supplier" }));
  // give both products a known cost: whey 2800, creatine 500
  await db.tx(async (q) => {
    const d = await savePurchaseDraft(q, STOCK, { supplierId: sup.id, supplierInvoiceNo: "R-1", lines: [{ variantId: whey1, qty: 10, unitCost: 2800 }, { variantId: creatine, qty: 10, unitCost: 500 }] });
    await confirmPurchase(q, STOCK, d.id);
  });
  // opening stock had no cost → weighted avg = purchase cost (documented approximation)
});
afterAll(() => db.close());

describe("reports use real data and consistent definitions", () => {
  it("online vs offline totals, payment totals, discounts, returns, historical cost, gross & operating profit", async () => {
    // offline: 2 × whey (₹7000) cash
    await createPosSale(db, CASHIER, { clientTxnId: txnId(), items: [{ variantId: whey1, qty: 2 }], payments: [{ method: "cash", amount: 7000 }] });
    // offline: 1 creatine with ₹100 discount by manager, UPI (₹699)
    await createPosSale(db, MANAGER, { clientTxnId: txnId(), items: [{ variantId: creatine, qty: 1 }], discount: { type: "amount", value: 100 }, payments: [{ method: "upi", amount: 699 }] });
    // online: 1 whey, COD (unpaid until delivered) — total 3500 (free delivery above 999)
    const { order } = await createOrder(db, { customer: { name: "Ravi K", phone: "9000012345", email: "", address: "1 Main Road, Velachery", city: "Chennai", district: "Chennai", state: "Tamil Nadu", pincode: "600042" }, items: [{ slug: "on-gold-whey", variantId: "1-kg", qty: 1 }], paymentMethod: "cod", clientKey: txnId() }, { location: { lat: 13.12, lng: 79.99, distanceKm: 1 } });
    // a return of 1 whey from the first bill (restocked)
    const first = (await db.query<{ id: string; item: string }>("select s.id, i.id as item from sales s join sale_items i on i.sale_id = s.id where s.channel = 'OFFLINE' and i.variant_id = $1 order by s.created_at limit 1", [whey1]))[0];
    await db.tx((q) => returnSale(q, MANAGER, first.id, { items: [{ saleItemId: first.item, qty: 1 }], reason: "Seal broken", refundMethod: "cash" }));
    // expenses: 1500 rent recorded, 200 voided
    await db.tx((q) => createExpense(q, OWNER, { date: today, category: "rent", amount: 1500, description: "Rent share" }));
    const voidId = await db.tx((q) => createExpense(q, OWNER, { date: today, category: "other", amount: 200, description: "Mistake" }));
    await db.tx((q) => voidExpense(q, OWNER, voidId, "entered twice"));

    const s = await salesSummary(db, P);
    expect(s.offlineTotal).toBe(7699);
    expect(s.onlineTotal).toBe(3500);
    expect(s.offlineBills).toBe(2);
    expect(s.onlineBills).toBe(1);
    expect(s.discounts).toBe(100);
    expect(s.returns.value).toBe(3500);
    // net sales = 7000 + 699 + 3500 − 3500 returned  (no GST, no delivery)
    expect(s.netSales).toBe(7699);
    // COGS = (2+1) whey × 2800 + 1 creatine × 500 − 1 returned whey × 2800
    expect(s.cogs).toBe(3 * 2800 + 500 - 2800);
    expect(s.grossProfit).toBe(7699 - (3 * 2800 + 500 - 2800));
    expect(s.expenses).toBe(1500); // voided one excluded
    expect(s.estimatedOperatingProfit).toBe(s.grossProfit - 1500);
    expect(s.missingCost.units).toBe(0);

    const ch = await salesSummary(db, { ...P, channel: "ONLINE" });
    expect(ch.billedTotal).toBe(3500);

    const pay = await collections(db, P);
    const by = Object.fromEntries(pay.map((p) => [p.method, p]));
    expect(by.cash.received).toBe(7000);
    expect(by.cash.refunded).toBe(3500);
    expect(by.cash.net).toBe(3500);
    expect(by.upi.net).toBe(699);
    expect(by.cod.pending).toBe(3500); // not collected yet → not counted as money received
    await db.tx((q) => updateOrder(q, MANAGER, order.id, { status: "delivered", paymentStatus: "paid" }));
    const pay2 = Object.fromEntries((await collections(db, P)).map((p) => [p.method, p]));
    expect(pay2.cod.received).toBe(3500);

    const prod = await productSales(db, P);
    const w = prod.find((r) => r.variant_id === whey1)!;
    expect(w.qty - w.returned).toBe(2);
    expect(w.cogs).toBe(5600);
  });

  it("historical cost basis: changing a product's cost later doesn't change past profit", async () => {
    const before = await salesSummary(db, P);
    await db.query("update product_variants set avg_cost = 9999 where id = $1", [whey1]);
    const after = await salesSummary(db, P);
    expect(after.cogs).toBe(before.cogs);
    expect(after.grossProfit).toBe(before.grossProfit);
    await db.query("update product_variants set avg_cost = 2800 where id = $1", [whey1]);
  });

  it("inventory valuation is at cost and separate from retail value (never profit)", async () => {
    const v = await stockValuation(db);
    expect(v.cost_value).toBeGreaterThan(0);
    expect(v.retail_value).toBeGreaterThan(v.cost_value);
  });
});

describe("bill / GST calculator", () => {
  it("not registered: no tax lines, plain receipt", () => {
    const b = computeBill([{ key: "a", name: "A", qty: 2, unitPrice: 100000, gstRate: 18 }], 0, { registered: false, inclusive: true, interState: false });
    expect(b.tax).toBe(0);
    expect(b.documentType).toBe("receipt");
    expect(b.total).toBe(200000);
  });
  it("registered + inclusive: tax extracted, CGST = SGST, total unchanged", () => {
    const b = computeBill([{ key: "a", name: "A", qty: 1, unitPrice: 118000, gstRate: 18 }], 0, { registered: true, inclusive: true, interState: false });
    expect(b.tax).toBe(18000);
    expect(b.cgst).toBe(9000);
    expect(b.sgst).toBe(9000);
    expect(b.total).toBe(118000);
    expect(b.documentType).toBe("tax_invoice");
  });
  it("registered + exclusive + inter-state: IGST added on top", () => {
    const b = computeBill([{ key: "a", name: "A", qty: 1, unitPrice: 100000, gstRate: 18 }], 0, { registered: true, inclusive: false, interState: true });
    expect(b.igst).toBe(18000);
    expect(b.total).toBe(118000);
  });
  it("discount is spread across lines before tax, pieces add up exactly", () => {
    const b = computeBill(
      [
        { key: "a", name: "A", qty: 1, unitPrice: 33333, gstRate: 5 },
        { key: "b", name: "B", qty: 2, unitPrice: 33333, gstRate: 18 },
      ],
      10001,
      { registered: true, inclusive: true, interState: false, roundToRupee: false },
    );
    expect(b.lines.reduce((s, l) => s + l.discount, 0)).toBe(10001);
    expect(b.total).toBe(99999 - 10001);
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
  });
  it("refuses to guess a missing GST rate", () => {
    expect(() => computeBill([{ key: "a", name: "Mystery", qty: 1, unitPrice: 100, gstRate: null }], 0, { registered: true, inclusive: true, interState: false })).toThrow(/never guessed/);
  });
});
