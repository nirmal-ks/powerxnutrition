import type { Queryable } from "@/lib/db/adapter";
import { newId } from "@/lib/db/ids";
import type { Actor } from "@/lib/permissions";
import { audit } from "./audit";
import { bad, conflict, notFound } from "./errors";

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  email: string;
  gstin: string;
  address: string;
  notes: string;
  active: boolean;
  created_at: string;
}

/** "Sri Murugan Traders Pvt. Ltd." and "sri murugan traders" are the same supplier. */
export const supplierKey = (name: string) =>
  name
    .toLowerCase()
    .replace(/\b(pvt|private|ltd|limited|llp|co|company|enterprises?|traders?|agencies|agency|and|&)\b\.?/g, " ")
    .replace(/[^a-z0-9]/g, "");

function similarity(a: string, b: string) {
  if (!a || !b) return 0;
  if (a.includes(b) || b.includes(a)) return 0.9;
  const grams = (s: string) => new Set(Array.from({ length: Math.max(1, s.length - 1) }, (_, i) => s.slice(i, i + 2)));
  const A = grams(a);
  const B = grams(b);
  let hit = 0;
  for (const g of A) if (B.has(g)) hit++;
  return (2 * hit) / (A.size + B.size);
}

/** Possible duplicates for the "did you mean…?" review before creating a supplier. */
export async function findSimilarSuppliers(q: Queryable, name: string, gstin?: string, phone?: string) {
  const key = supplierKey(name);
  const all = await q.query<Supplier & { name_key: string }>("select * from suppliers");
  return all
    .map((s) => ({
      supplier: s,
      score: Math.max(
        similarity(key, s.name_key),
        gstin && s.gstin && gstin.toUpperCase() === s.gstin.toUpperCase() ? 1 : 0,
        phone && s.phone && phone.replace(/\D/g, "").slice(-10) === s.phone.replace(/\D/g, "").slice(-10) ? 0.95 : 0,
      ),
    }))
    .filter((x) => x.score >= 0.6)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function parse(raw: Partial<Supplier>) {
  const s = {
    name: str(raw.name, 120),
    phone: str(raw.phone, 30),
    email: str(raw.email, 120),
    gstin: str(raw.gstin, 15).toUpperCase(),
    address: str(raw.address, 400),
    notes: str(raw.notes, 1000),
  };
  if (s.name.length < 2) throw bad("Enter the supplier name");
  if (s.gstin && !/^\d{2}[A-Z0-9]{13}$/.test(s.gstin)) throw bad("Supplier GSTIN should be 15 characters");
  return s;
}

export async function createSupplier(q: Queryable, actor: Actor, raw: Partial<Supplier>, opts: { confirmNotDuplicate?: boolean } = {}) {
  const s = parse(raw);
  const key = supplierKey(s.name) || s.name.toLowerCase();
  const exact = await q.query<Supplier>("select * from suppliers where name_key = $1", [key]);
  if (exact[0]) throw conflict(`Supplier “${exact[0].name}” already exists — choose it instead of creating a duplicate.`);
  if (!opts.confirmNotDuplicate) {
    const similar = await findSimilarSuppliers(q, s.name, s.gstin, s.phone);
    if (similar.length) {
      throw conflict(`Similar supplier(s) already exist: ${similar.map((x) => x.supplier.name).join(", ")}. Use one of them, or confirm this is a different supplier.`, {
        similar: similar.map((x) => ({ id: x.supplier.id, name: x.supplier.name, phone: x.supplier.phone })),
      });
    }
  }
  const id = newId();
  await q.query(
    "insert into suppliers (id, name, name_key, phone, email, gstin, address, notes) values ($1,$2,$3,$4,$5,$6,$7,$8)",
    [id, s.name, key, s.phone, s.email, s.gstin, s.address, s.notes],
  );
  await audit(q, actor, "supplier.created", { type: "supplier", id }, `Added supplier ${s.name}`);
  return (await getSupplier(q, id))!;
}

export async function updateSupplier(q: Queryable, actor: Actor, id: string, raw: Partial<Supplier>) {
  const cur = await getSupplier(q, id);
  if (!cur) throw notFound("Supplier not found");
  const s = parse({ ...cur, ...raw });
  const key = supplierKey(s.name) || s.name.toLowerCase();
  const clash = await q.query<{ id: string; name: string }>("select id, name from suppliers where name_key = $1 and id <> $2", [key, id]);
  if (clash[0]) throw conflict(`Another supplier is already called “${clash[0].name}”`);
  await q.query(
    "update suppliers set name=$2, name_key=$3, phone=$4, email=$5, gstin=$6, address=$7, notes=$8, active=$9, updated_at=now() where id=$1",
    [id, s.name, key, s.phone, s.email, s.gstin, s.address, s.notes, raw.active === undefined ? cur.active : Boolean(raw.active)],
  );
  await audit(q, actor, "supplier.updated", { type: "supplier", id }, `Updated supplier ${s.name}`);
  return (await getSupplier(q, id))!;
}

export async function getSupplier(q: Queryable, id: string) {
  return (await q.query<Supplier>("select id, name, phone, email, gstin, address, notes, active, created_at from suppliers where id = $1", [id]))[0] ?? null;
}

export async function listSuppliers(q: Queryable, opts: { search?: string } = {}) {
  const s = opts.search ? `%${opts.search.trim()}%` : null;
  return q.query<Supplier & { purchases: number; purchase_total: number; outstanding: number; last_purchase: string | null }>(
    `select s.id, s.name, s.phone, s.email, s.gstin, s.address, s.notes, s.active, s.created_at,
            count(p.id) filter (where p.status = 'confirmed')::int as purchases,
            coalesce(sum(p.total) filter (where p.status = 'confirmed'), 0) as purchase_total,
            coalesce(sum(p.total - p.paid_amount) filter (where p.status = 'confirmed'), 0) as outstanding,
            max(p.confirmed_at) as last_purchase
     from suppliers s left join purchases p on p.supplier_id = s.id
     ${s ? "where s.name ilike $1 or s.phone like $1 or s.gstin ilike $1" : ""}
     group by s.id order by s.active desc, s.name`,
    s ? [s] : [],
  );
}

/** Products this supplier has delivered (from confirmed purchases), with last cost. */
export async function supplierProducts(q: Queryable, supplierId: string) {
  return q.query<{ variant_id: string; name: string; label: string; flavour: string; qty: number; last_cost: number; last_date: string }>(
    `select distinct on (pi.variant_id) pi.variant_id, pr.name, v.label, v.flavour,
            sum(pi.qty) over (partition by pi.variant_id)::int as qty, pi.unit_cost as last_cost, pu.confirmed_at as last_date
     from purchase_items pi join purchases pu on pu.id = pi.purchase_id
     join product_variants v on v.id = pi.variant_id join products pr on pr.id = v.product_id
     where pu.supplier_id = $1 and pu.status = 'confirmed'
     order by pi.variant_id, pu.confirmed_at desc`,
    [supplierId],
  );
}
