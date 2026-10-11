import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/adapter";
import { createPosSale, getSale, returnSale, voidSale } from "@/lib/server/sales";
import { saveSettings } from "@/lib/server/settings";
import { CASHIER, MANAGER, OWNER, movementCount, stockOf, testDb, txnId, variantId } from "./helpers/db";

let db: Db;
let whey1: string;
let creatine: string;

beforeAll(async () => {
  db = await testDb();
  whey1 = await variantId(db, "on-gold-whey", "1-kg");
  creatine = await variantId(db, "mb-creatine", "250-g");
});
afterAll(() => db.close());

describe("POS / offline billing", () => {
  it("completes a cash sale: bill number, items, payment, stock deducted once, movements, cashier", async () => {
    const before = await stockOf(db, whey1);
    const { sale, duplicate } = await createPosSale(db, CASHIER, {
      clientTxnId: txnId(),
      items: [{ variantId: whey1, qty: 2 }],
      payments: [{ method: "cash", amount: 7000, tendered: 7500 }],
      customer: { name: "Ravi", phone: "9876543210" },
    });
    expect(duplicate).toBe(false);
    expect(sale.channel).toBe("OFFLINE");
    expect(sale.bill_no).toMatch(/^PXR\/\d\d-\d\d\/00001$/);
    expect(sale.total).toBe(7000);
    expect(sale.document_type).toBe("receipt");
    expect(sale.tax_total).toBe(0);
    expect(sale.cashier_name).toBe("Cashier");
    expect(sale.items).toHaveLength(1);
    expect(sale.payments[0]).toMatchObject({ method: "cash", amount: 7000, status: "received" });
    expect(sale.payments[0].notes).toContain("change ₹500");
    expect(await stockOf(db, whey1)).toBe(before - 2);
    expect(await movementCount(db, "ref_id = $1 and type = 'SALE_OFFLINE'", [sale.id])).toBe(1);
    const cust = await db.query<{ phone: string }>("select phone from customers where phone = '9876543210'");
    expect(cust).toHaveLength(1);
  });

  it("records UPI as received by the cashier, never as gateway-verified", async () => {
    const { sale } = await createPosSale(db, CASHIER, {
      clientTxnId: txnId(),
      items: [{ variantId: creatine, qty: 1 }],
      payments: [{ method: "upi", amount: 799, reference: "412345678901" }],
    });
    expect(sale.payments[0].status).toBe("received");
    expect(sale.payments[0].status).not.toBe("verified");
    expect(sale.payments[0].reference).toBe("412345678901");
    expect(sale.payments[0].notes).toMatch(/not gateway-verified/);
  });

  it("supports split payments that must add up to the server total", async () => {
    await expect(
      createPosSale(db, CASHIER, { clientTxnId: txnId(), items: [{ variantId: whey1, qty: 1 }], payments: [{ method: "cash", amount: 1000 }] }),
    ).rejects.toThrow(/must add up/);
    const { sale } = await createPosSale(db, CASHIER, {
      clientTxnId: txnId(),
      items: [{ variantId: whey1, qty: 1 }],
      payments: [
        { method: "cash", amount: 1500 },
        { method: "upi", amount: 2000 },
      ],
    });
    expect(sale.payments).toHaveLength(2);
  });

  it("rejects invalid quantities", async () => {
    for (const qty of [0, -1, 1.5]) {
      await expect(
        createPosSale(db, CASHIER, { clientTxnId: txnId(), items: [{ variantId: whey1, qty }], payments: [{ method: "cash", amount: 3500 }] }),
      ).rejects.toThrow(/whole number/);
    }
  });

  it("blocks selling more than is in stock and leaves stock untouched", async () => {
    const stock = await stockOf(db, creatine);
    const moves = await movementCount(db);
    await expect(
      createPosSale(db, CASHIER, {
        clientTxnId: txnId(),
        items: [{ variantId: creatine, qty: stock + 1 }],
        payments: [{ method: "cash", amount: 799 * (stock + 1) }],
      }),
    ).rejects.toThrow(/in stock|out of stock/);
    expect(await stockOf(db, creatine)).toBe(stock);
    expect(await movementCount(db)).toBe(moves);
  });

  it("returns the same bill for a duplicate submission (double click / retry)", async () => {
    const id = txnId();
    const input = { clientTxnId: id, items: [{ variantId: whey1, qty: 1 }], payments: [{ method: "cash" as const, amount: 3500 }] };
    const before = await stockOf(db, whey1);
    const a = await createPosSale(db, CASHIER, input);
    const b = await createPosSale(db, CASHIER, input);
    expect(b.duplicate).toBe(true);
    expect(b.sale.id).toBe(a.sale.id);
    expect(await stockOf(db, whey1)).toBe(before - 1);
    expect((await db.query("select 1 from sales where client_txn_id = $1", [id])).length).toBe(1);
  });

  it("never oversells under concurrent sales of the last units", async () => {
    // creatine has little stock left; fire many concurrent 1-unit sales
    const stock = await stockOf(db, creatine);
    const results = await Promise.allSettled(
      Array.from({ length: stock + 3 }, () =>
        createPosSale(db, CASHIER, { clientTxnId: txnId(), items: [{ variantId: creatine, qty: 1 }], payments: [{ method: "cash", amount: 799 }] }),
      ),
    );
    const ok = results.filter((r) => r.status === "fulfilled").length;
    expect(ok).toBe(stock);
    expect(await stockOf(db, creatine)).toBe(0);
  });

  it("enforces the cashier discount limit on the server", async () => {
    await expect(
      createPosSale(db, CASHIER, {
        clientTxnId: txnId(),
        items: [{ variantId: whey1, qty: 1 }],
        discount: { type: "percent", value: 20 },
        payments: [{ method: "cash", amount: 2800 }],
      }),
    ).rejects.toThrow(/discount limit is 5%/);
    const { sale } = await createPosSale(db, MANAGER, {
      clientTxnId: txnId(),
      items: [{ variantId: whey1, qty: 1 }],
      discount: { type: "percent", value: 20 },
      payments: [{ method: "cash", amount: 2800 }],
    });
    expect(sale.discount).toBe(700);
    expect(sale.total).toBe(2800);
  });

  it("refuses when the browser's expected total differs (price changed meanwhile)", async () => {
    await expect(
      createPosSale(db, CASHIER, {
        clientTxnId: txnId(),
        items: [{ variantId: whey1, qty: 1 }],
        payments: [{ method: "cash", amount: 3500 }],
        expectedTotal: 3400,
      }),
    ).rejects.toThrow(/Prices changed/);
  });

  it("partial return restores stock to the batch and refunds the paid share; cashier can't return", async () => {
    const { sale } = await createPosSale(db, CASHIER, {
      clientTxnId: txnId(),
      items: [{ variantId: whey1, qty: 3 }],
      payments: [{ method: "cash", amount: 10500 }],
    });
    const item = sale.items[0];
    await expect(db.tx((q) => returnSale(q, CASHIER, sale.id, { items: [{ saleItemId: item.id, qty: 1 }], reason: "Damaged seal", refundMethod: "cash" }))).rejects.toThrow(
      /manager or the owner/,
    );
    const before = await stockOf(db, whey1);
    const r = await db.tx((q) => returnSale(q, MANAGER, sale.id, { items: [{ saleItemId: item.id, qty: 1 }], reason: "Wrong flavour", refundMethod: "cash" }));
    expect(r.refund).toBe(3500);
    expect(await stockOf(db, whey1)).toBe(before + 1);
    const after = await getSale(db, sale.id);
    expect(after!.status).toBe("partially_returned");
    expect(after!.items[0].returned_qty).toBe(1);
    // original bill values untouched
    expect(after!.total).toBe(10500);
    await expect(db.tx((q) => returnSale(q, MANAGER, sale.id, { items: [{ saleItemId: item.id, qty: 5 }], reason: "too many", refundMethod: "cash" }))).rejects.toThrow(
      /can still be returned/,
    );
  });

  it("cancels (voids) a whole bill with a reversal, not by deleting it", async () => {
    const { sale } = await createPosSale(db, CASHIER, {
      clientTxnId: txnId(),
      items: [{ variantId: whey1, qty: 2 }],
      payments: [{ method: "upi", amount: 7000 }],
    });
    const before = await stockOf(db, whey1);
    await db.tx((q) => voidSale(q, OWNER, sale.id, "Customer changed mind", "upi"));
    expect(await stockOf(db, whey1)).toBe(before + 2);
    const s = await getSale(db, sale.id);
    expect(s!.status).toBe("cancelled");
    expect(s!.returns[0].kind).toBe("void");
    expect(s!.payments.find((p) => p.direction === "out")?.amount).toBe(7000);
    expect(await movementCount(db, "type = 'CANCELLATION' and ref_type = 'return'")).toBeGreaterThan(0);
    await expect(db.tx((q) => voidSale(q, OWNER, sale.id, "again", "upi"))).rejects.toThrow();
  });

  it("history rows are append-only at the database level", async () => {
    await expect(db.query("delete from inventory_movements")).rejects.toThrow(/append-only/);
    await expect(db.query("update audit_logs set summary = 'x'")).rejects.toThrow(/append-only/);
  });

  it("issues GST tax invoices only when registered, with CGST/SGST split and no guessed rates", async () => {
    await db.tx((q) =>
      saveSettings(q, OWNER, "business", { gstRegistered: true, gstin: "33ABCDE1234F1Z5", legalName: "PowerX Nutrition", stateCode: "33" }),
    );
    // product has no GST rate → refuse
    await expect(
      createPosSale(db, CASHIER, { clientTxnId: txnId(), items: [{ variantId: whey1, qty: 1 }], payments: [{ method: "cash", amount: 3500 }] }),
    ).rejects.toThrow(/GST rate is not set/);
    await db.query("update products set gst_rate = 18, hsn = '2106' where slug = 'on-gold-whey'");
    const { sale } = await createPosSale(db, CASHIER, { clientTxnId: txnId(), items: [{ variantId: whey1, qty: 1 }], payments: [{ method: "cash", amount: 3500 }] });
    expect(sale.document_type).toBe("tax_invoice");
    expect(sale.bill_no).toMatch(/^PX\//);
    expect(sale.total).toBe(3500); // inclusive pricing
    expect(sale.tax_total).toBeCloseTo(533.9, 1);
    expect(sale.cgst + sale.sgst).toBeCloseTo(sale.tax_total, 2);
    expect(sale.igst).toBe(0);
    expect(sale.taxable_value + sale.tax_total).toBeCloseTo(3500, 2);
    const log = await db.query<{ action: string }>("select action from audit_logs where action = 'settings.tax_changed'");
    expect(log.length).toBe(1);
    await db.tx((q) => saveSettings(q, OWNER, "business", { gstRegistered: false }));
  });
});
