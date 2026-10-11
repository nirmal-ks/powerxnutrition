import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPostgresDb, type Db } from "@/lib/db/adapter";
import { migrate } from "@/lib/db";
import { seedIfEmpty } from "@/lib/db/seed";
import { confirmPurchase, savePurchaseDraft } from "@/lib/server/purchases";
import { createPosSale, getSale } from "@/lib/server/sales";
import { createSupplier } from "@/lib/server/suppliers";
import { CASHIER, OWNER, STOCK, sampleProducts, txnId } from "./helpers/db";

/**
 * Exercises the production `pg` (node-postgres) code path — the one used with DATABASE_URL on
 * Supabase/Vercel — over the real Postgres wire protocol (PGlite exposed on a local socket).
 */
let server: PGLiteSocketServer;
let backend: PGlite;
let db: Db;

beforeAll(async () => {
  backend = await PGlite.create();
  server = new PGLiteSocketServer({ db: backend, port: 54329, host: "127.0.0.1" });
  await server.start();
  process.env.DATABASE_POOL_MAX = "1"; // the test socket server serialises one connection
  db = await createPostgresDb("postgres://postgres:postgres@127.0.0.1:54329/postgres?sslmode=disable");
  await migrate(db);
  await seedIfEmpty(db, { dataOverride: { products: sampleProducts, orders: [] } });
});
afterAll(async () => {
  await db?.close();
  await server?.stop();
  await backend?.close();
});

describe("node-postgres adapter (DATABASE_URL path)", () => {
  it("runs migrations, seeds, and returns numbers/dates with the same types as PGlite", async () => {
    const r = await db.query<{ price: number; stock: number; created_at: string; n: number }>(
      "select v.price, v.stock, v.created_at, (select count(*) from products) as n from product_variants v order by v.price limit 1",
    );
    expect(typeof r[0].price).toBe("number");
    expect(typeof r[0].n).toBe("number");
    expect(r[0].created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    const v = await db.query("select version from schema_migrations order by version");
    expect(v.length).toBe(2);
  });

  it("purchase + POS sale + duplicate protection + rollback work identically", async () => {
    const vid = (await db.query<{ id: string }>("select v.id from product_variants v join products p on p.id = v.product_id where p.slug = 'on-gold-whey' and v.code = '1-kg'"))[0].id;
    const sup = await db.tx((q) => createSupplier(q, OWNER, { name: "PG Supplier" }));
    await db.tx(async (q) => {
      const d = await savePurchaseDraft(q, STOCK, { supplierId: sup.id, supplierInvoiceNo: "PG-1", lines: [{ variantId: vid, qty: 5, unitCost: 2800 }] });
      await confirmPurchase(q, STOCK, d.id);
    });
    const id = txnId();
    const a = await createPosSale(db, CASHIER, { clientTxnId: id, items: [{ variantId: vid, qty: 2 }], payments: [{ method: "cash", amount: 7000 }] });
    const b = await createPosSale(db, CASHIER, { clientTxnId: id, items: [{ variantId: vid, qty: 2 }], payments: [{ method: "cash", amount: 7000 }] });
    expect(b.duplicate).toBe(true);
    expect((await getSale(db, a.sale.id))!.total).toBe(7000);
    const stock = (await db.query<{ stock: number }>("select stock from product_variants where id = $1", [vid]))[0].stock;
    expect(stock).toBe(20 + 5 - 2);
    await expect(createPosSale(db, CASHIER, { clientTxnId: txnId(), items: [{ variantId: vid, qty: 999 }], payments: [{ method: "cash", amount: 3496500 }] })).rejects.toThrow(/in stock/);
    expect((await db.query<{ stock: number }>("select stock from product_variants where id = $1", [vid]))[0].stock).toBe(23);
    await expect(db.query("delete from audit_logs")).rejects.toThrow(/append-only/);
  });
});
