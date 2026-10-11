import { json, readJson, searchParams, staffRoute } from "@/lib/api";
import { createSupplier, findSimilarSuppliers, listSuppliers, type Supplier } from "@/lib/server/suppliers";

export const GET = staffRoute(["suppliers.manage", "purchases.create"], async (req, { db }) => {
  const sp = searchParams(req);
  if (sp.get("similar")) return json({ similar: await findSimilarSuppliers(db, sp.get("similar")!) });
  return json({ suppliers: await listSuppliers(db, { search: sp.get("q") ?? undefined }) });
});

/** Creates a supplier; similar names are returned for review unless confirmNotDuplicate is set. */
export const POST = staffRoute("suppliers.manage", async (req, { db, actor }) => {
  const body = await readJson<Partial<Supplier> & { confirmNotDuplicate?: boolean }>(req);
  const supplier = await db.tx((q) => createSupplier(q, actor, body, { confirmNotDuplicate: body.confirmNotDuplicate }));
  return json({ supplier }, 201);
});
