import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/adapter";
import { createOrder } from "@/lib/server/orders";
import { listProducts } from "@/lib/server/products";
import { confirmPurchase, getPurchase, savePurchaseDraft } from "@/lib/server/purchases";
import { createPosSale } from "@/lib/server/sales";
import { createSupplier } from "@/lib/server/suppliers";
import { CASHIER, MANAGER, OWNER, STOCK, movementCount, stockOf, testDb, txnId, variantId } from "./helpers/db";

let db: Db;
let whey1: string;
let supplierId: string;

const customer = { name: "Arun Kumar", phone: "9876501234", email: "", address: "12 Gandhi Street, Anna Nagar", city: "Chennai", district: "Chennai", state: "Tamil Nadu", pincode: "600040" };

beforeAll(async () => {
  db = await testDb();
  whey1 = await variantId(db, "on-gold-whey", "1-kg");
  supplierId = (await db.tx((q) => createSupplier(q, OWNER, { name: "Sri Murugan Traders", phone: "9000000001" }))).id;
});
afterAll(() => db.close());

describe("online + offline share ONE inventory", () => {
  it("20 − 2 online − 3 shop + 10 received − 4 shop = 21", async () => {
    expect(await stockOf(db, whey1)).toBe(20);
    await createOrder(db, { customer, items: [{ slug: "on-gold-whey", variantId: "1-kg", qty: 2 }], paymentMethod: "upi", clientKey: txnId() }, {});
    expect(await stockOf(db, whey1)).toBe(18);
    await createPosSale(db, CASHIER, { clientTxnId: txnId(), items: [{ variantId: whey1, qty: 3 }], payments: [{ method: "cash", amount: 10500 }] });
    expect(await stockOf(db, whey1)).toBe(15);
    await db.tx(async (q) => {
      const d = await savePurchaseDraft(q, STOCK, { supplierId, supplierInvoiceNo: "SYNC-1", lines: [{ variantId: whey1, qty: 10, unitCost: 2800 }] });
      await confirmPurchase(q, STOCK, d.id);
    });
    expect(await stockOf(db, whey1)).toBe(25);
    await createPosSale(db, CASHIER, { clientTxnId: txnId(), items: [{ variantId: whey1, qty: 4 }], payments: [{ method: "upi", amount: 14000 }] });
    expect(await stockOf(db, whey1)).toBe(21);
    // the ledger explains the number exactly
    const sum = await db.query<{ s: number }>("select sum(qty_change)::int as s from inventory_movements where variant_id = $1", [whey1]);
    expect(sum[0].s).toBe(21);
    // the storefront reads the same number
    const p = (await listProducts(db, { publishedOnly: true })).find((x) => x.slug === "on-gold-whey")!;
    expect(p.variants.find((v) => v.id === "1-kg")!.stock).toBe(21);
  });
});

describe("stock receiving", () => {
  it("draft purchases never change stock; confirming adds stock exactly once", async () => {
    const before = await stockOf(db, whey1);
    const draft = await db.tx((q) => savePurchaseDraft(q, STOCK, { supplierId, supplierInvoiceNo: "INV-100", lines: [{ variantId: whey1, qty: 6, unitCost: 2700, batchNo: "B1", expiryDate: "2028-01-31" }] }));
    expect(draft.status).toBe("draft");
    expect(await stockOf(db, whey1)).toBe(before);
    const a = await db.tx((q) => confirmPurchase(q, STOCK, draft.id));
    const b = await db.tx((q) => confirmPurchase(q, STOCK, draft.id)); // double tap
    expect(a.duplicate).toBe(false);
    expect(b.duplicate).toBe(true);
    expect(await stockOf(db, whey1)).toBe(before + 6);
    expect(await movementCount(db, "ref_id = $1", [draft.id])).toBe(1);
    const batch = await db.query<{ batch_no: string; expiry_date: string; qty_remaining: number }>("select batch_no, expiry_date, qty_remaining from batches where purchase_id = $1", [draft.id]);
    expect(batch[0]).toMatchObject({ batch_no: "B1", expiry_date: "2028-01-31", qty_remaining: 6 });
  });

  it("concurrent confirmations of the same draft still add stock once", async () => {
    const before = await stockOf(db, whey1);
    const draft = await db.tx((q) => savePurchaseDraft(q, STOCK, { supplierId, supplierInvoiceNo: "INV-RACE", lines: [{ variantId: whey1, qty: 3, unitCost: 2700 }] }));
    await Promise.allSettled([1, 2, 3].map(() => db.tx((q) => confirmPurchase(q, STOCK, draft.id))));
    expect(await stockOf(db, whey1)).toBe(before + 3);
  });

  it("blocks the same supplier invoice twice; only the owner can override with a reason (audited)", async () => {
    const d2 = await db.tx((q) => savePurchaseDraft(q, STOCK, { supplierId, supplierInvoiceNo: "inv-100", lines: [{ variantId: whey1, qty: 6, unitCost: 2700 }] }));
    await expect(db.tx((q) => confirmPurchase(q, STOCK, d2.id))).rejects.toThrow(/already received/);
    await expect(db.tx((q) => confirmPurchase(q, MANAGER, d2.id, { overrideDuplicateReason: "second truck" }))).rejects.toThrow(/Only the owner/);
    const before = await stockOf(db, whey1);
    await db.tx((q) => confirmPurchase(q, OWNER, d2.id, { overrideDuplicateReason: "Supplier sent 2nd delivery on same bill" }));
    expect(await stockOf(db, whey1)).toBe(before + 6);
    const log = await db.query("select 1 from audit_logs where action = 'purchase.duplicate_override' and entity_id = $1", [d2.id]);
    expect(log.length).toBe(1);
  });

  it("creates a NEW product (unpublished, photo pending) on confirmation and stocks it", async () => {
    const d = await db.tx((q) =>
      savePurchaseDraft(q, STOCK, {
        supplierId,
        supplierInvoiceNo: "INV-NEW",
        lines: [{ newProduct: { name: "Platinum Creatine", brand: "MuscleTech", category: "creatine", label: "400 g", flavour: "Unflavoured", sku: "MT-CRE-400", price: 1599 }, qty: 4, unitCost: 1000 }],
      }),
    );
    const r = await db.tx((q) => confirmPurchase(q, STOCK, d.id));
    const vid = r.purchase.items[0].variant_id!;
    expect(await stockOf(db, vid)).toBe(4);
    const p = await db.query<{ status: string; image_status: string }>("select p.status, p.image_status from products p join product_variants v on v.product_id = p.id where v.id = $1", [vid]);
    expect(p[0]).toEqual({ status: "draft", image_status: "IMAGE_PENDING" });
    // a later receipt with the same SKU reuses it — no duplicate product
    const d2 = await db.tx((q) => savePurchaseDraft(q, STOCK, { supplierId, supplierInvoiceNo: "INV-NEW-2", lines: [{ newProduct: { name: "Platinum Creatine 400g", brand: "MuscleTech", category: "creatine", label: "400 g", sku: "mt-cre-400", price: 1599 }, qty: 2, unitCost: 1000 }] }));
    const r2 = await db.tx((q) => confirmPurchase(q, STOCK, d2.id));
    expect(r2.purchase.items[0].variant_id).toBe(vid);
    expect(await stockOf(db, vid)).toBe(6);
  });

  it("validates quantity, cost and supplier", async () => {
    await expect(db.tx((q) => savePurchaseDraft(q, STOCK, { supplierId: "", lines: [{ variantId: whey1, qty: 1, unitCost: 1 }] }))).rejects.toThrow(/supplier/i);
    await expect(db.tx((q) => savePurchaseDraft(q, STOCK, { supplierId, lines: [{ variantId: whey1, qty: 0, unitCost: 1 }] }))).rejects.toThrow(/quantity/);
    await expect(db.tx((q) => savePurchaseDraft(q, STOCK, { supplierId, lines: [{ variantId: whey1, qty: 1, unitCost: -5 }] }))).rejects.toThrow(/cost/);
    await expect(db.tx((q) => savePurchaseDraft(q, CASHIER, { supplierId, lines: [{ variantId: whey1, qty: 1, unitCost: 5 }] }))).rejects.toThrow(/permission/);
  });

  it("a failed confirmation rolls back every line (no partial stock)", async () => {
    const before = await stockOf(db, whey1);
    const d = await db.tx((q) =>
      savePurchaseDraft(q, STOCK, {
        supplierId,
        supplierInvoiceNo: "INV-FAIL",
        lines: [
          { variantId: whey1, qty: 5, unitCost: 2700 },
          { newProduct: { name: "Bad", brand: "X", category: "creatine", label: "1 kg", sku: "MT-CRE-400-DUP", barcode: "", price: 100 }, qty: 1, unitCost: 1 },
        ],
      }),
    );
    // sabotage line 2 so the database rejects it mid-confirmation
    await db.query("update purchase_items set new_product = jsonb_set(new_product, '{category}', '\"no-such\"') where purchase_id = $1 and line_no = 2", [d.id]);
    await db.query("alter table products add constraint tmp_cat check (category <> 'no-such')");
    await expect(db.tx((q) => confirmPurchase(q, STOCK, d.id))).rejects.toThrow();
    await db.query("alter table products drop constraint tmp_cat");
    expect(await stockOf(db, whey1)).toBe(before);
    expect((await getPurchase(db, d.id))!.status).toBe("draft");
  });

  it("keeps historical sale cost when the purchase cost changes (weighted average)", async () => {
    const creatine = await variantId(db, "mb-creatine", "250-g");
    await db.tx(async (q) => {
      const d = await savePurchaseDraft(q, STOCK, { supplierId, supplierInvoiceNo: "C-1", lines: [{ variantId: creatine, qty: 10, unitCost: 400 }] });
      await confirmPurchase(q, STOCK, d.id);
    });
    const s1 = await createPosSale(db, CASHIER, { clientTxnId: txnId(), items: [{ variantId: creatine, qty: 1 }], payments: [{ method: "cash", amount: 799 }] });
    const firstCost = (await db.query<{ unit_cost: number }>("select unit_cost from sale_items where sale_id = $1", [s1.sale.id]))[0].unit_cost;
    await db.tx(async (q) => {
      const d = await savePurchaseDraft(q, STOCK, { supplierId, supplierInvoiceNo: "C-2", lines: [{ variantId: creatine, qty: 10, unitCost: 600 }] });
      await confirmPurchase(q, STOCK, d.id);
    });
    const avg = (await db.query<{ avg_cost: number }>("select avg_cost from product_variants where id = $1", [creatine]))[0].avg_cost;
    expect(avg).toBeGreaterThan(firstCost);
    const again = (await db.query<{ unit_cost: number }>("select unit_cost from sale_items where sale_id = $1", [s1.sale.id]))[0].unit_cost;
    expect(again).toBe(firstCost); // history untouched
  });

  it("sells from the earliest-expiring batch first (FEFO)", async () => {
    const whey2 = await variantId(db, "on-gold-whey", "2-kg");
    await db.tx(async (q) => {
      const d = await savePurchaseDraft(q, STOCK, {
        supplierId,
        supplierInvoiceNo: "FEFO",
        lines: [
          { variantId: whey2, qty: 2, unitCost: 5000, batchNo: "LATE", expiryDate: "2029-12-31" },
          { variantId: whey2, qty: 2, unitCost: 5000, batchNo: "EARLY", expiryDate: "2027-06-30" },
        ],
      });
      await confirmPurchase(q, STOCK, d.id);
    });
    const { sale } = await createPosSale(db, CASHIER, { clientTxnId: txnId(), items: [{ variantId: whey2, qty: 1 }], payments: [{ method: "cash", amount: 6500 }] });
    const m = await db.query<{ batch_no: string | null }>("select b.batch_no from inventory_movements m left join batches b on b.id = m.batch_id where m.ref_id = $1", [sale.id]);
    expect(m[0].batch_no).toBe("EARLY");
  });
});
