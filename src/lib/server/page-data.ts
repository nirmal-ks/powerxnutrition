import "server-only";
import { categories } from "@/lib/catalog";
import { getDb } from "@/lib/db";

/** Small lookups many admin pages need. */
export async function supplierOptions() {
  const db = await getDb();
  return db.query<{ id: string; name: string; phone: string }>("select id, name, phone from suppliers where active order by name");
}

export const categoryOptions = () => categories.map((c) => ({ slug: c.slug, name: c.name }));
