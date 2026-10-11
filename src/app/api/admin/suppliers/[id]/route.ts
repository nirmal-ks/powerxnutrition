import { json, readJson, staffRoute } from "@/lib/api";
import { listPurchases } from "@/lib/server/purchases";
import { getSupplier, supplierProducts, updateSupplier, type Supplier } from "@/lib/server/suppliers";

type P = { id: string };

export const GET = staffRoute<P>(["suppliers.manage", "purchases.create"], async (_req, { db, params }) => {
  const supplier = await getSupplier(db, params.id);
  if (!supplier) return json({ error: "Supplier not found" }, 404);
  const [purchases, products, invoices] = await Promise.all([
    listPurchases(db, { supplierId: params.id, limit: 200 }),
    supplierProducts(db, params.id),
    db.query("select id, file_name, invoice_no, status, created_at from invoice_imports where supplier_id = $1 and status <> 'discarded' order by created_at desc limit 50", [params.id]),
  ]);
  return json({ supplier, purchases, products, invoices });
});

export const PATCH = staffRoute<P>("suppliers.manage", async (req, { db, actor, params }) => {
  const body = await readJson<Partial<Supplier>>(req);
  return json({ supplier: await db.tx((q) => updateSupplier(q, actor, params.id, body)) });
});
