import type { Queryable } from "@/lib/db/adapter";
import { newId } from "@/lib/db/ids";
import { whereBuilder } from "@/lib/db/where";
import type { Actor } from "@/lib/permissions";
import { audit } from "./audit";
import { AppError, bad, notFound } from "./errors";

/**
 * THE inventory engine. Every stock change in the system (online orders, POS bills, purchase
 * receipts, returns, cancellations, adjustments) goes through these functions, inside the
 * caller's database transaction:
 *  - stock is changed with one conditional UPDATE (`stock + change >= 0`), so two tills selling
 *    the last unit at the same moment can't both succeed;
 *  - each change writes an inventory_movements row; a unique index on (ref, line, batch, type)
 *    makes a duplicate deduction for the same transaction line impossible at the database level;
 *  - stock leaves batches earliest-expiry-first (FEFO) and returns go back to the same batches.
 */

export type MovementType = "OPENING" | "PURCHASE_RECEIPT" | "SALE_OFFLINE" | "SALE_ONLINE" | "RETURN" | "CANCELLATION" | "ADJUSTMENT";

export class InsufficientStockError extends AppError {
  constructor(public variantName: string, public available: number, public requested: number) {
    super(
      available > 0
        ? `Only ${available} in stock for ${variantName} (you asked for ${requested}).`
        : `${variantName} is out of stock.`,
      409,
    );
  }
}

interface MoveBase {
  variantId: string;
  type: MovementType;
  refType: string;
  refId: string;
  refLine?: string;
  actor: Actor;
  note?: string;
  unitCost?: number | null;
}

async function variantName(q: Queryable, variantId: string) {
  const r = await q.query<{ name: string; label: string; flavour: string; stock: number }>(
    `select p.name, v.label, v.flavour, v.stock from product_variants v join products p on p.id = v.product_id where v.id = $1`,
    [variantId],
  );
  if (!r[0]) throw notFound("Product variant not found");
  return { name: `${r[0].name} (${[r[0].label, r[0].flavour].filter(Boolean).join(", ")})`, stock: r[0].stock };
}

async function insertMovement(
  q: Queryable,
  m: MoveBase & { qty: number; batchId?: string | null; stockAfter: number },
) {
  try {
    await q.query(
      `insert into inventory_movements (variant_id, qty_change, type, ref_type, ref_id, ref_line, batch_id, unit_cost, stock_after, user_id, user_name, note)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [m.variantId, m.qty, m.type, m.refType, m.refId, m.refLine ?? "", m.batchId ?? null, m.unitCost ?? null, m.stockAfter, m.actor.id, m.actor.name, m.note ?? ""],
    );
  } catch (e) {
    if (String((e as Error).message).includes("inventory_movements_once_uq")) {
      throw new AppError("This stock change was already recorded (duplicate request blocked).", 409);
    }
    throw e;
  }
}

/** Atomically changes the on-hand quantity. Throws InsufficientStockError instead of going negative. */
async function changeStock(q: Queryable, variantId: string, delta: number, allowNegative: boolean): Promise<number> {
  const rows = await q.query<{ stock: number }>(
    `update product_variants set stock = stock + $2, updated_at = now()
     where id = $1 and ($3::boolean or stock + $2 >= 0) returning stock`,
    [variantId, delta, allowNegative],
  );
  if (rows[0]) return rows[0].stock;
  const v = await variantName(q, variantId);
  throw new InsufficientStockError(v.name, v.stock, -delta);
}

export interface Allocation {
  batchId: string | null;
  qty: number;
}

/**
 * Takes `qty` units out of stock (sales, negative adjustments). Allocates to batches FEFO.
 * Returns the batch allocations so returns can put stock back where it came from.
 */
export async function deductStock(
  q: Queryable,
  m: MoveBase & { qty: number; allowNegative: boolean; batchId?: string | null },
): Promise<Allocation[]> {
  if (!Number.isInteger(m.qty) || m.qty <= 0) throw bad("Quantity must be a whole number above 0");
  const after = await changeStock(q, m.variantId, -m.qty, m.allowNegative);
  let running = after + m.qty;

  const batches = m.batchId
    ? await q.query<{ id: string; qty_remaining: number }>(
        "select id, qty_remaining from batches where id = $1 and variant_id = $2 for update",
        [m.batchId, m.variantId],
      )
    : await q.query<{ id: string; qty_remaining: number }>(
        `select id, qty_remaining from batches where variant_id = $1 and qty_remaining > 0
         order by expiry_date asc nulls last, received_at asc for update`,
        [m.variantId],
      );
  const allocations: Allocation[] = [];
  let left = m.qty;
  for (const b of batches) {
    if (left <= 0) break;
    const take = Math.min(left, b.qty_remaining);
    if (take <= 0) continue;
    await q.query("update batches set qty_remaining = qty_remaining - $2 where id = $1", [b.id, take]);
    allocations.push({ batchId: b.id, qty: take });
    left -= take;
  }
  if (left > 0) allocations.push({ batchId: null, qty: left }); // opening stock / un-batched units

  for (const a of allocations) {
    running -= a.qty;
    await insertMovement(q, { ...m, qty: -a.qty, batchId: a.batchId, stockAfter: running });
  }
  return allocations;
}

/** Puts units back (returns, cancellations, positive adjustments), optionally into specific batches. */
export async function addStock(q: Queryable, m: MoveBase & { qty: number; allocations?: Allocation[] }): Promise<number> {
  if (!Number.isInteger(m.qty) || m.qty <= 0) throw bad("Quantity must be a whole number above 0");
  const after = await changeStock(q, m.variantId, m.qty, true);
  let running = after - m.qty;
  const parts = m.allocations?.length ? m.allocations : [{ batchId: null, qty: m.qty }];
  for (const a of parts) {
    if (a.batchId) await q.query("update batches set qty_remaining = qty_remaining + $2 where id = $1", [a.batchId, a.qty]);
    running += a.qty;
    await insertMovement(q, { ...m, qty: a.qty, batchId: a.batchId, stockAfter: running });
  }
  return after;
}

/**
 * Original batch allocation of a sale line minus what has already been returned/cancelled —
 * so a return puts stock back into the right batches and never more than was taken.
 */
export async function returnableAllocations(q: Queryable, saleItemId: string, qty: number): Promise<Allocation[]> {
  const taken = await q.query<{ batch_id: string | null; qty: number }>(
    `select batch_id, sum(-qty_change)::int as qty from inventory_movements
     where ref_line = $1 and type in ('SALE_OFFLINE','SALE_ONLINE') group by batch_id`,
    [saleItemId],
  );
  const back = await q.query<{ batch_id: string | null; qty: number }>(
    `select batch_id, sum(qty_change)::int as qty from inventory_movements
     where ref_line = $1 and type in ('RETURN','CANCELLATION') group by batch_id`,
    [saleItemId],
  );
  const backBy = new Map(back.map((b) => [b.batch_id ?? "", b.qty]));
  // return to the latest-expiring batches first (reverse of FEFO) – simplest consistent rule
  const out: Allocation[] = [];
  let left = qty;
  for (const t of taken.reverse()) {
    const avail = t.qty - (backBy.get(t.batch_id ?? "") ?? 0);
    const give = Math.min(left, Math.max(0, avail));
    if (give > 0) out.push({ batchId: t.batch_id, qty: give });
    left -= give;
  }
  if (left > 0) out.push({ batchId: null, qty: left });
  return out;
}

/**
 * Purchase receipt for one line: creates a batch, raises stock, updates weighted-average cost.
 * Average cost = (old stock × old avg + received × cost) / (old stock + received).
 */
export async function receiveStock(
  q: Queryable,
  m: Omit<MoveBase, "type"> & {
    qty: number;
    unitCost: number;
    batchNo?: string;
    mfgDate?: string | null;
    expiryDate?: string | null;
    purchaseId: string;
    supplierId: string;
  },
): Promise<{ batchId: string; stockAfter: number }> {
  if (!Number.isInteger(m.qty) || m.qty <= 0) throw bad("Received quantity must be a whole number above 0");
  if (!(m.unitCost >= 0)) throw bad("Purchase cost can't be negative");
  const rows = await q.query<{ stock: number }>(
    `update product_variants set
       avg_cost = case when stock <= 0 or avg_cost is null then $2::numeric
                       else round(((stock * avg_cost) + ($3 * $2::numeric)) / (stock + $3), 2) end,
       last_cost = $2::numeric,
       stock = stock + $3,
       updated_at = now()
     where id = $1 returning stock`,
    [m.variantId, m.unitCost, m.qty],
  );
  if (!rows[0]) throw notFound("Product variant not found");
  const batchId = newId();
  await q.query(
    `insert into batches (id, variant_id, batch_no, mfg_date, expiry_date, unit_cost, qty_received, qty_remaining, purchase_id, supplier_id)
     values ($1,$2,$3,$4,$5,$6,$7,$7,$8,$9)`,
    [batchId, m.variantId, m.batchNo ?? "", m.mfgDate || null, m.expiryDate || null, m.unitCost, m.qty, m.purchaseId, m.supplierId],
  );
  await insertMovement(q, { ...m, type: "PURCHASE_RECEIPT", qty: m.qty, batchId, stockAfter: rows[0].stock });
  return { batchId, stockAfter: rows[0].stock };
}

const ADJUST_REASONS = ["count_correction", "damaged", "expired", "lost", "free_sample", "found", "other"] as const;
export type AdjustReason = (typeof ADJUST_REASONS)[number];

/** Manual stock correction by an authorised person. Always needs a reason; always audited. */
export async function adjustStock(
  q: Queryable,
  actor: Actor,
  input: { variantId: string; change: number; reason: AdjustReason; note?: string; batchId?: string | null; clientTxnId?: string },
  allowNegative: boolean,
) {
  const change = Math.trunc(Number(input.change));
  if (!change) throw bad("Enter how many units to add (+) or remove (−)");
  if (Math.abs(change) > 100000) throw bad("That quantity looks wrong");
  if (!ADJUST_REASONS.includes(input.reason)) throw bad("Choose a reason for the adjustment");
  if (input.reason === "other" && !input.note?.trim()) throw bad("Describe the reason");
  const refId = input.clientTxnId && /^[\w-]{8,64}$/.test(input.clientTxnId) ? input.clientTxnId : newId();
  const v = await variantName(q, input.variantId);
  const base = { variantId: input.variantId, type: "ADJUSTMENT" as const, refType: "adjustment", refId, actor, note: `${input.reason}${input.note ? `: ${input.note.trim().slice(0, 200)}` : ""}` };
  if (change > 0) await addStock(q, { ...base, qty: change, allocations: input.batchId ? [{ batchId: input.batchId, qty: change }] : undefined });
  else await deductStock(q, { ...base, qty: -change, allowNegative, batchId: input.batchId });
  await audit(q, actor, "stock.adjusted", { type: "variant", id: input.variantId }, `${change > 0 ? "+" : ""}${change} × ${v.name} (${input.reason})`, {
    change,
    reason: input.reason,
    note: input.note,
    before: v.stock,
    batchId: input.batchId ?? null,
  });
}

// ------------------------------------------------------------------ read models

export interface InventoryRow {
  variant_id: string;
  product_id: string;
  slug: string;
  name: string;
  brand: string;
  category: string;
  status: string;
  image: string;
  image_status: string;
  label: string;
  flavour: string;
  sku: string | null;
  barcode: string | null;
  price: number;
  mrp: number;
  stock: number;
  avg_cost: number | null;
  min_stock: number;
  supplier_id: string | null;
  supplier_name: string | null;
  next_expiry: string | null;
  expiring_qty: number;
  batch_count: number;
}

export async function inventoryOverview(
  q: Queryable,
  f: { search?: string; brand?: string; category?: string; supplierId?: string; low?: boolean; expiringDays?: number; includeArchived?: boolean } = {},
) {
  const w = whereBuilder();
  if (!f.includeArchived) w.add("p.status <> 'archived'");
  w.add("v.active");
  if (f.search) {
    const s = `%${f.search.trim()}%`;
    w.add("(p.name ilike ? or p.brand ilike ? or v.sku ilike ? or v.barcode ilike ? or v.label ilike ? or v.flavour ilike ?)", s, s, s, s, s, s);
  }
  if (f.brand) w.add("lower(p.brand) = lower(?)", f.brand);
  if (f.category) w.add("p.category = ?", f.category);
  if (f.supplierId) {
    w.add("(p.default_supplier_id = ? or exists (select 1 from batches b2 where b2.variant_id = v.id and b2.supplier_id = ?))", f.supplierId, f.supplierId);
  }
  if (f.low) w.add("v.stock <= v.min_stock");
  const days = w.param(f.expiringDays ?? 60);
  if (f.expiringDays) w.add(`exists (select 1 from batches b3 where b3.variant_id = v.id and b3.qty_remaining > 0 and b3.expiry_date is not null and b3.expiry_date <= ist_date(now()) + ${days}::int)`);
  return q.query<InventoryRow>(
    `select v.id as variant_id, p.id as product_id, p.slug, p.name, p.brand, p.category, p.status, p.image, p.image_status,
            v.label, v.flavour, v.sku, v.barcode, v.price, v.mrp, v.stock, v.avg_cost, v.min_stock,
            p.default_supplier_id as supplier_id, s.name as supplier_name,
            (select min(b.expiry_date) from batches b where b.variant_id = v.id and b.qty_remaining > 0) as next_expiry,
            coalesce((select sum(b.qty_remaining) from batches b where b.variant_id = v.id and b.qty_remaining > 0
                      and b.expiry_date is not null and b.expiry_date <= ist_date(now()) + ${days}::int), 0)::int as expiring_qty,
            (select count(*) from batches b where b.variant_id = v.id and b.qty_remaining > 0)::int as batch_count
     from product_variants v join products p on p.id = v.product_id
     left join suppliers s on s.id = p.default_supplier_id
     ${w.sql}
     order by p.sort, p.name, v.sort`,
    w.params,
  );
}

export interface MovementRow {
  id: number;
  created_at: string;
  variant_id: string;
  product_name: string;
  label: string;
  flavour: string;
  qty_change: number;
  type: MovementType;
  ref_type: string;
  ref_id: string;
  ref_label: string | null;
  batch_no: string | null;
  stock_after: number;
  user_name: string;
  note: string;
}

export async function listMovements(
  q: Queryable,
  f: { variantId?: string; productId?: string; type?: string; from?: string; to?: string; search?: string; limit?: number; offset?: number } = {},
) {
  const w = whereBuilder();
  if (f.variantId) w.add("m.variant_id = ?", f.variantId);
  if (f.productId) w.add("v.product_id = ?", f.productId);
  if (f.type) w.add("m.type = ?", f.type);
  if (f.from) w.add("ist_date(m.created_at) >= ?::date", f.from);
  if (f.to) w.add("ist_date(m.created_at) <= ?::date", f.to);
  if (f.search) {
    const s = `%${f.search}%`;
    w.add("(p.name ilike ? or v.sku ilike ? or m.ref_id ilike ? or s.bill_no ilike ? or pu.purchase_no ilike ?)", s, s, s, s, s);
  }
  const limit = w.param(Math.min(f.limit ?? 100, 1000));
  const offset = w.param(f.offset ?? 0);
  return q.query<MovementRow>(
    `select m.id, m.created_at, m.variant_id, p.name as product_name, v.label, v.flavour, m.qty_change, m.type, m.ref_type, m.ref_id,
            coalesce(s.bill_no, pu.purchase_no, r.return_no, case when m.ref_type = 'order' then m.ref_id end) as ref_label,
            b.batch_no, m.stock_after, m.user_name, m.note
     from inventory_movements m
     join product_variants v on v.id = m.variant_id
     join products p on p.id = v.product_id
     left join batches b on b.id = m.batch_id
     left join sales s on m.ref_type = 'sale' and s.id = m.ref_id
     left join purchases pu on m.ref_type = 'purchase' and pu.id = m.ref_id
     left join sale_returns r on m.ref_type = 'return' and r.id = m.ref_id
     ${w.sql}
     order by m.id desc limit ${limit} offset ${offset}`,
    w.params,
  );
}

export interface BatchRow {
  id: string;
  variant_id: string;
  product_name: string;
  label: string;
  flavour: string;
  batch_no: string;
  mfg_date: string | null;
  expiry_date: string | null;
  unit_cost: number | null;
  qty_received: number;
  qty_remaining: number;
  supplier_name: string | null;
  purchase_no: string | null;
  received_at: string;
}

export async function listBatches(q: Queryable, f: { variantId?: string; expiringDays?: number; onlyRemaining?: boolean } = {}) {
  const w = whereBuilder();
  if (f.variantId) w.add("b.variant_id = ?", f.variantId);
  if (f.onlyRemaining !== false) w.add("b.qty_remaining > 0");
  if (f.expiringDays) w.add("b.expiry_date is not null and b.expiry_date <= ist_date(now()) + ?::int", f.expiringDays);
  return q.query<BatchRow>(
    `select b.id, b.variant_id, p.name as product_name, v.label, v.flavour, b.batch_no, b.mfg_date, b.expiry_date, b.unit_cost,
            b.qty_received, b.qty_remaining, s.name as supplier_name, pu.purchase_no, b.received_at
     from batches b join product_variants v on v.id = b.variant_id join products p on p.id = v.product_id
     left join suppliers s on s.id = b.supplier_id left join purchases pu on pu.id = b.purchase_id
     ${w.sql} order by b.expiry_date asc nulls last, b.received_at desc limit 500`,
    w.params,
  );
}
