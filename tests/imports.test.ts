import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/adapter";
import { confirmImport, createImportPreview, getImport, updateImportRows } from "@/lib/server/stock-import";
import { createSupplier } from "@/lib/server/suppliers";
import { parseCsv, readXlsx, writeXlsx } from "@/lib/server/xlsx";
import { CASHIER, OWNER, STOCK, stockOf, testDb, variantId } from "./helpers/db";

let db: Db;
let whey1: string;
let supplierId: string;

const HEADER = "SKU,Barcode,Brand,Product Name,Category,Size,Flavour,Quantity,Purchase Cost,Selling Price,MRP,GST %,Supplier,Supplier Invoice No,Batch No,Mfg Date,Expiry Date";

beforeAll(async () => {
  db = await testDb();
  whey1 = await variantId(db, "on-gold-whey", "1-kg");
  await db.query("update product_variants set sku = 'ON-1KG', barcode = '748927052138' where id = $1", [whey1]);
  supplierId = (await db.tx((q) => createSupplier(q, OWNER, { name: "Fitness Distributors" }))).id;
});
afterAll(() => db.close());

describe("spreadsheet parsing", () => {
  it("parses CSV with quotes, commas and BOM", () => {
    const rows = parseCsv('﻿a,b,c\r\n"x, y","he said ""hi""",3\n');
    expect(rows).toEqual([["a", "b", "c"], ["x, y", 'he said "hi"', "3"]]);
  });
  it("writes and reads back a real .xlsx (template round-trip)", () => {
    const buf = writeXlsx([["SKU", "Quantity"], ["ON-1KG", 5]]);
    expect(buf.subarray(0, 2).toString()).toBe("PK");
    expect(readXlsx(buf)).toEqual([["SKU", "Quantity"], ["ON-1KG", "5"]]);
  });
});

describe("bulk stock import", () => {
  it("uploading only creates a preview — stock does not change", async () => {
    const before = await stockOf(db, whey1);
    const csv = `${HEADER}\nON-1KG,,,,,,,5,2700,,,,Fitness Distributors,IMP-1,B9,2026-01-01,2027-12-31\n`;
    const { id, rows } = await db.tx((q) => createImportPreview(q, STOCK, "delivery.csv", Buffer.from(csv)));
    expect(rows[0]).toMatchObject({ action: "existing", variantId: whey1, matchedBy: "sku", errors: [] });
    expect(await stockOf(db, whey1)).toBe(before);
    const r = await confirmImport(db, STOCK, id);
    expect(r.duplicate).toBe(false);
    expect(await stockOf(db, whey1)).toBe(before + 5);
    // confirming again does nothing
    const again = await confirmImport(db, STOCK, id);
    expect(again.duplicate).toBe(true);
    expect(await stockOf(db, whey1)).toBe(before + 5);
    expect((await getImport(db, id))!.status).toBe("confirmed");
  });

  it("matches by barcode, proposes NEW products, and flags invalid rows (nothing imported until fixed)", async () => {
    const csv = [
      HEADER,
      ",748927052138,,,,,,2,2700,,,,Fitness Distributors,IMP-2,,,",
      "MB-EAA-450,,MuscleBlaze,EAA Advanced,amino-acids,450 g,Watermelon,6,900,1299,1499,18,Fitness Distributors,IMP-2,,,",
      "ON-1KG,,,,,,,abc,,,,,Unknown Supplier,IMP-2,,31/13/2027,",
    ].join("\n");
    const { id, rows } = await db.tx((q) => createImportPreview(q, STOCK, "mixed.csv", Buffer.from(csv)));
    expect(rows[0]).toMatchObject({ variantId: whey1, matchedBy: "barcode" });
    expect(rows[1].action).toBe("new");
    expect(rows[1].errors).toEqual([]);
    expect(rows[2].errors.join(" ")).toMatch(/Quantity/);
    expect(rows[2].errors.join(" ")).toMatch(/Purchase cost/);
    expect(rows[2].errors.join(" ")).toMatch(/not a valid date/);
    expect(rows[2].errors.join(" ")).toMatch(/Unknown Supplier/);
    const before = await stockOf(db, whey1);
    await expect(confirmImport(db, STOCK, id)).rejects.toThrow(/still have errors/);
    expect(await stockOf(db, whey1)).toBe(before);
    // staff rejects the bad row → import goes through atomically
    await db.tx((q) => updateImportRows(q, STOCK, id, { rows: [{ line: 4, action: "reject" }] }));
    const r = await confirmImport(db, STOCK, id);
    expect(r.summary).toMatchObject({ imported: 2, rejected: 1, newProducts: 1, units: 8 });
    expect(await stockOf(db, whey1)).toBe(before + 2);
    const eaa = await db.query<{ stock: number; status: string }>("select v.stock, p.status from product_variants v join products p on p.id = v.product_id where v.sku = 'MB-EAA-450'");
    expect(eaa[0]).toEqual({ stock: 6, status: "draft" });
  });

  it("never auto-matches a different size: similar names become suggestions", async () => {
    const csv = `${HEADER}\n,,Optimum Nutrition,Gold Standard 100% Whey,,2 kg,,1,5000,,,,Fitness Distributors,IMP-3,,,\n,,Optimum Nutrition,Gold Standard 100% Whey,,5 lb,,1,9000,,,,Fitness Distributors,IMP-3,,,`;
    const { rows } = await db.tx((q) => createImportPreview(q, STOCK, "sizes.csv", Buffer.from(csv)));
    const whey2 = await variantId(db, "on-gold-whey", "2-kg");
    expect(rows[0].variantId === whey2 || rows[0].candidates[0]?.variantId === whey2).toBe(true);
    expect(rows[1].variantId).not.toBe(whey1); // 5 lb ≠ 1 kg
    expect(rows[1].variantId).not.toBe(whey2); // 5 lb ≠ 2 kg
  });

  it("a duplicate supplier invoice inside an import blocks the whole import (no partial stock)", async () => {
    const before = await stockOf(db, whey1);
    const csv = `${HEADER}\nON-1KG,,,,,,,4,2700,,,,Fitness Distributors,IMP-1,,,\n`; // IMP-1 already received
    const { id } = await db.tx((q) => createImportPreview(q, STOCK, "again.csv", Buffer.from(csv)));
    await expect(confirmImport(db, STOCK, id)).rejects.toThrow(/already received/);
    expect(await stockOf(db, whey1)).toBe(before);
    expect((await getImport(db, id))!.error).toMatch(/already received/);
  });

  it("rejects files without the needed columns and blocks unauthorised staff", async () => {
    await expect(db.tx((q) => createImportPreview(q, STOCK, "bad.csv", Buffer.from("foo,bar\n1,2\n")))).rejects.toThrow(/Quantity/);
    await expect(db.tx((q) => createImportPreview(q, CASHIER, "x.csv", Buffer.from(`${HEADER}\n`)))).rejects.toThrow(/permission/);
  });

  it("imports an .xlsx file too", async () => {
    const before = await stockOf(db, whey1);
    const buf = writeXlsx([HEADER.split(","), ["ON-1KG", "", "", "", "", "", "", 3, 2750, "", "", "", "Fitness Distributors", "XL-1", "", "", ""]]);
    const { id, rows } = await db.tx((q) => createImportPreview(q, STOCK, "delivery.xlsx", buf));
    expect(rows[0].errors).toEqual([]);
    await confirmImport(db, STOCK, id);
    expect(await stockOf(db, whey1)).toBe(before + 3);
  });
});
