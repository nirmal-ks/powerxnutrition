import type { Queryable } from "@/lib/db/adapter";
import { newId, nextDocumentNo } from "@/lib/db/ids";
import { whereBuilder } from "@/lib/db/where";
import { toPaise, toRupees } from "@/lib/money";
import { can, type Actor } from "@/lib/permissions";
import type { AllSettings } from "@/lib/settings-types";
import { BillError, computeBill } from "@/lib/tax";
import { audit } from "./audit";
import { cleanPhone, isMobile, upsertCustomer } from "./customers";
import { AppError, bad, conflict, forbidden, notFound } from "./errors";
import { addStock, deductStock, returnableAllocations } from "./inventory";
import { getSettings } from "./settings";

export type PosPaymentMethod = "cash" | "upi" | "card" | "other";
export type SalePaymentMethod = PosPaymentMethod | "cod" | "razorpay";

export interface SaleItemView {
  id: string;
  line_no: number;
  variant_id: string;
  product_name: string;
  variant_label: string;
  sku: string;
  hsn: string;
  qty: number;
  unit_price: number;
  discount: number;
  taxable_value: number;
  tax_rate: number;
  tax_amount: number;
  line_total: number;
  unit_cost?: number | null;
  returned_qty: number;
}

export interface PaymentView {
  id: string;
  direction: "in" | "out";
  method: string;
  amount: number;
  status: string;
  reference: string;
  notes: string;
  created_at: string;
}

export interface SaleView {
  id: string;
  bill_no: string;
  channel: "ONLINE" | "OFFLINE";
  order_id: string | null;
  status: string;
  document_type: "receipt" | "tax_invoice";
  tax_mode: string;
  place_of_supply: string;
  customer_name: string;
  customer_phone: string;
  subtotal: number;
  discount: number;
  taxable_value: number;
  cgst: number;
  sgst: number;
  igst: number;
  tax_total: number;
  delivery: number;
  round_off: number;
  total: number;
  payment_status: string;
  business: Record<string, unknown> | null;
  notes: string;
  cashier_name: string;
  created_at: string;
  offline_created_at: string | null;
  items: SaleItemView[];
  payments: PaymentView[];
  returns: { id: string; return_no: string; kind: string; reason: string; refund_amount: number; created_by_name: string; created_at: string }[];
}

interface VariantForSale {
  id: string;
  name: string;
  label: string;
  flavour: string;
  sku: string | null;
  hsn: string;
  gst_rate: number | null;
  price: number;
  avg_cost: number | null;
  status: string;
  active: boolean;
}

async function loadVariants(q: Queryable, ids: string[]) {
  const rows = await q.query<VariantForSale>(
    `select v.id, p.name, v.label, v.flavour, v.sku, p.hsn, p.gst_rate, v.price, v.avg_cost, p.status, v.active
     from product_variants v join products p on p.id = v.product_id where v.id = any($1::text[])`,
    [ids],
  );
  return new Map(rows.map((r) => [r.id, r]));
}

function businessSnapshot(s: AllSettings) {
  const b = s.business;
  return {
    tradeName: b.tradeName,
    legalName: b.legalName,
    address: b.address,
    state: b.state,
    stateCode: b.stateCode,
    phone: b.phone,
    email: b.email,
    gstin: b.gstRegistered ? b.gstin : "",
    footer: b.receiptFooter,
  };
}

interface RecordSaleInput {
  channel: "ONLINE" | "OFFLINE";
  items: { variantId: string; qty: number; unitPrice?: number }[];
  discountPaise: number;
  deliveryPaise?: number;
  interState?: boolean;
  placeOfSupply?: string;
  customer?: { name?: string; phone?: string; email?: string; address?: Record<string, string> | null };
  payments: { method: SalePaymentMethod; amount: number; status: string; reference?: string; notes?: string; gatewayOrderId?: string }[] | "auto";
  clientTxnId?: string | null;
  orderId?: string | null;
  notes?: string;
  skipStock?: boolean;
  createdAt?: string;
  offlineCreatedAt?: string | null;
  forceInclusive?: boolean;
  paymentStatus?: "paid" | "partial" | "unpaid";
}

/** Shared by POS bills and online orders. Must run inside a transaction. */
export async function recordSale(q: Queryable, actor: Actor, input: RecordSaleInput, settings?: AllSettings) {
  const s = settings ?? (await getSettings(q));
  if (!input.items.length) throw bad("Add at least one item");
  // merge duplicate lines of the same variant
  const merged = new Map<string, { variantId: string; qty: number; unitPrice?: number }>();
  for (const it of input.items) {
    const qty = Number(it.qty);
    if (!Number.isInteger(qty) || qty <= 0 || qty > 1000) throw bad("Each quantity must be a whole number between 1 and 1000");
    const key = `${it.variantId}|${it.unitPrice ?? ""}`;
    const m = merged.get(key);
    if (m) m.qty += qty;
    else merged.set(key, { variantId: String(it.variantId), qty, unitPrice: it.unitPrice });
  }
  const lines = [...merged.values()];
  if (lines.length > 100) throw bad("Too many lines on one bill");
  const variants = await loadVariants(q, lines.map((l) => l.variantId));
  for (const l of lines) {
    const v = variants.get(l.variantId);
    if (!v || !v.active || v.status === "archived") throw conflict("A product on this bill is no longer available. Remove it and search again.");
  }

  let bill;
  try {
    bill = computeBill(
      lines.map((l, i) => {
        const v = variants.get(l.variantId)!;
        return { key: String(i), name: `${v.name} (${v.label})`, qty: l.qty, unitPrice: toPaise(l.unitPrice ?? v.price), gstRate: v.gst_rate };
      }),
      input.discountPaise,
      {
        registered: s.business.gstRegistered,
        inclusive: input.forceInclusive ? true : s.business.pricesIncludeTax,
        interState: Boolean(input.interState),
        deliveryRate: s.business.deliveryGstRate,
        roundToRupee: s.business.roundToRupee,
      },
      input.deliveryPaise ?? 0,
    );
  } catch (e) {
    if (e instanceof BillError) throw bad(e.message);
    throw e;
  }

  const total = toRupees(bill.total);
  const payments =
    input.payments === "auto"
      ? []
      : input.payments.map((p) => ({ ...p, amount: Math.round(Number(p.amount) * 100) / 100 }));
  if (input.payments !== "auto" && input.channel === "OFFLINE") {
    const paid = payments.reduce((sum, p) => sum + toPaise(p.amount), 0);
    if (paid !== bill.total) throw bad(`Payments (₹${toRupees(paid)}) must add up to the bill total (₹${total})`);
  }

  const id = newId();
  const series = bill.documentType === "tax_invoice" ? s.business.billPrefix : `${s.business.billPrefix}R`;
  const billNo = await nextDocumentNo(q, bill.documentType, series, input.createdAt ? new Date(input.createdAt) : new Date());
  const phone = cleanPhone(input.customer?.phone);
  const customerId = await upsertCustomer(q, { ...input.customer, phone });

  await q.query(
    `insert into sales (id, bill_no, channel, order_id, client_txn_id, customer_id, customer_name, customer_phone, status, document_type, tax_mode,
       place_of_supply, subtotal, discount, taxable_value, cgst, sgst, igst, tax_total, delivery, round_off, total, payment_status, business, notes,
       cashier_id, cashier_name, created_at, offline_created_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,'completed',$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,coalesce($27::timestamptz, now()),$28)`,
    [id, billNo, input.channel, input.orderId ?? null, input.clientTxnId ?? null, customerId, (input.customer?.name ?? "").trim().slice(0, 80),
      isMobile(phone) ? phone : "", bill.documentType, bill.taxMode, input.placeOfSupply ?? s.business.state,
      toRupees(bill.subtotal), toRupees(bill.discount), toRupees(bill.taxable), toRupees(bill.cgst), toRupees(bill.sgst), toRupees(bill.igst),
      toRupees(bill.tax), toRupees(bill.delivery), toRupees(bill.roundOff), total, input.paymentStatus ?? "paid", JSON.stringify(businessSnapshot(s)),
      (input.notes ?? "").slice(0, 300), actor.id, actor.name, input.createdAt ?? null, input.offlineCreatedAt ?? null],
  );

  const itemIds: string[] = [];
  for (const [i, l] of lines.entries()) {
    const v = variants.get(l.variantId)!;
    const b = bill.lines[i];
    const itemId = newId();
    itemIds.push(itemId);
    await q.query(
      `insert into sale_items (id, sale_id, line_no, variant_id, product_name, variant_label, sku, hsn, qty, unit_price, discount, taxable_value, tax_rate, tax_amount, line_total, unit_cost)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [itemId, id, i + 1, v.id, v.name, [v.label, v.flavour].filter(Boolean).join(" · "), v.sku ?? "", v.hsn, b.qty, toRupees(b.unitPrice),
        toRupees(b.discount), toRupees(b.taxable), b.taxRate, toRupees(b.tax), toRupees(b.total), v.avg_cost],
    );
    if (!input.skipStock) {
      await deductStock(q, {
        variantId: v.id,
        qty: b.qty,
        type: input.channel === "OFFLINE" ? "SALE_OFFLINE" : "SALE_ONLINE",
        refType: "sale",
        refId: id,
        refLine: itemId,
        actor,
        unitCost: v.avg_cost,
        allowNegative: s.operations.allowNegativeStock,
        note: input.orderId ? `Order ${input.orderId}` : billNo,
      });
    }
  }

  for (const p of payments) {
    await q.query(
      `insert into payments (id, sale_id, order_id, direction, method, amount, status, reference, gateway_order_id, recorded_by, notes)
       values ($1,$2,$3,'in',$4,$5,$6,$7,$8,$9,$10)`,
      [newId(), id, input.orderId ?? null, p.method, p.amount, p.status, (p.reference ?? "").slice(0, 60), p.gatewayOrderId ?? null, actor.id, (p.notes ?? "").slice(0, 200)],
    );
  }
  return { id, billNo, total, bill, itemIds };
}

// ------------------------------------------------------------------ POS (offline channel)

export interface PosSaleInput {
  clientTxnId: string;
  items: { variantId: string; qty: number }[];
  discount?: { type: "amount" | "percent"; value: number } | null;
  payments: { method: PosPaymentMethod; amount: number; reference?: string; tendered?: number }[];
  customer?: { name?: string; phone?: string };
  notes?: string;
  /** Total the cashier saw. If the server's total differs (price changed meanwhile) we refuse and show both. */
  expectedTotal?: number;
  /** Bill made while offline and synced later. */
  offlineCreatedAt?: string;
}

export function maxDiscountPct(actor: Actor, s: AllSettings) {
  if (actor.role === "owner") return 100;
  if (can(actor.role, "discount.extended")) return s.operations.managerMaxDiscountPct;
  return s.operations.cashierMaxDiscountPct;
}

const TXN_RE = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * Completes a POS bill exactly once. The POS generates `clientTxnId` when the bill is started;
 * double-clicks, retries and offline re-syncs with the same id return the original bill instead
 * of creating a second one (enforced by a unique index, so it holds under concurrency too).
 */
export async function createPosSale(db: { tx: <T>(fn: (q: Queryable) => Promise<T>) => Promise<T> } & Queryable, actor: Actor, input: PosSaleInput) {
  if (!can(actor.role, "sales.create")) throw forbidden();
  if (!TXN_RE.test(String(input.clientTxnId ?? ""))) throw bad("Missing transaction id — refresh the billing page");
  const existing = await db.query<{ id: string }>("select id from sales where client_txn_id = $1", [input.clientTxnId]);
  if (existing[0]) return { sale: (await getSale(db, existing[0].id))!, duplicate: true };

  try {
    const id = await db.tx(async (q) => {
      const s = await getSettings(q);
      const enabled = s.operations.paymentMethods;
      if (!Array.isArray(input.payments) || !input.payments.length) throw bad("Choose how the customer paid");
      for (const p of input.payments) {
        if (!["cash", "upi", "card", "other"].includes(p.method) || !enabled[p.method]) throw bad(`Payment method "${p.method}" is not enabled`);
        if (!(Number(p.amount) > 0)) throw bad("Payment amount must be above 0");
      }

      // Discount is checked against the server-side subtotal and the person's limit.
      const variants = await loadVariants(q, input.items.map((i) => String(i.variantId)));
      const subtotal = input.items.reduce((sum, i) => sum + toPaise(variants.get(String(i.variantId))?.price ?? 0) * (Number(i.qty) || 0), 0);
      let discountPaise = 0;
      if (input.discount && Number(input.discount.value) > 0) {
        const val = Number(input.discount.value);
        discountPaise = input.discount.type === "percent" ? Math.round((subtotal * Math.min(val, 100)) / 100) : toPaise(val);
        if (discountPaise > subtotal) throw bad("Discount can't be more than the bill amount");
        const pct = subtotal ? (discountPaise / subtotal) * 100 : 0;
        const limit = maxDiscountPct(actor, s);
        if (pct > limit + 1e-9) throw forbidden(`Your discount limit is ${limit}% — ask a manager/owner to apply a bigger discount`);
      }

      const sale = await recordSale(
        q,
        actor,
        {
          channel: "OFFLINE",
          items: input.items.map((i) => ({ variantId: String(i.variantId), qty: Number(i.qty) })),
          discountPaise,
          customer: input.customer,
          clientTxnId: input.clientTxnId,
          notes: input.notes,
          offlineCreatedAt: input.offlineCreatedAt && !Number.isNaN(Date.parse(input.offlineCreatedAt)) ? new Date(input.offlineCreatedAt).toISOString() : null,
          payments: input.payments.map((p) => {
            const tendered = p.method === "cash" && Number(p.tendered) > Number(p.amount) ? Number(p.tendered) : 0;
            return {
              method: p.method,
              amount: Number(p.amount),
              // A shop UPI/card payment is recorded as received by the cashier — NOT gateway-verified.
              status: "received",
              reference: String(p.reference ?? "").trim(),
              notes: tendered ? `Cash given ₹${tendered}, change ₹${Math.round((tendered - Number(p.amount)) * 100) / 100}` : p.method === "upi" ? "Recorded by cashier (not gateway-verified)" : "",
            };
          }),
        },
        s,
      );
      if (input.expectedTotal !== undefined && toPaise(input.expectedTotal) !== toPaise(sale.total)) {
        throw new PriceChangedError(sale.total);
      }
      await audit(q, actor, "sale.completed", { type: "sale", id: sale.id }, `Bill ${sale.billNo} · ₹${sale.total} · ${input.payments.map((p) => p.method).join("+")}`, {
        channel: "OFFLINE",
        total: sale.total,
        discount: toRupees(sale.bill.discount),
        ...(sale.bill.discount ? { discountBy: actor.name } : {}),
        offline: Boolean(input.offlineCreatedAt),
      });
      return sale.id;
    });
    return { sale: (await getSale(db, id))!, duplicate: false };
  } catch (e) {
    // Two identical requests raced: the loser hits the unique index → return the winner's bill.
    if (String((e as Error)?.message ?? "").includes("sales_client_txn_id_key")) {
      const again = await db.query<{ id: string }>("select id from sales where client_txn_id = $1", [input.clientTxnId]);
      if (again[0]) return { sale: (await getSale(db, again[0].id))!, duplicate: true };
    }
    throw e;
  }
}

export class PriceChangedError extends AppError {
  constructor(public serverTotal: number) {
    super(`Prices changed since this bill was started. The correct total is ₹${serverTotal}. Please review the bill and complete it again.`, 409, { serverTotal, code: "PRICE_CHANGED" });
  }
}

// ------------------------------------------------------------------ reading

export async function getSale(q: Queryable, id: string, opts: { includeCost?: boolean } = {}): Promise<SaleView | null> {
  const rows = await q.query<Omit<SaleView, "items" | "payments" | "returns">>(
    `select id, bill_no, channel, order_id, status, document_type, tax_mode, place_of_supply, customer_name, customer_phone, subtotal, discount,
            taxable_value, cgst, sgst, igst, tax_total, delivery, round_off, total, payment_status, business, notes, cashier_name, created_at, offline_created_at
     from sales where id = $1 or bill_no = $1`,
    [id],
  );
  if (!rows[0]) return null;
  const sid = rows[0].id;
  const [items, payments, returns] = await Promise.all([
    q.query<SaleItemView>(
      `select id, line_no, variant_id, product_name, variant_label, sku, hsn, qty, unit_price, discount, taxable_value, tax_rate, tax_amount, line_total,
              ${opts.includeCost ? "unit_cost," : ""} returned_qty from sale_items where sale_id = $1 order by line_no`,
      [sid],
    ),
    q.query<PaymentView>("select id, direction, method, amount, status, reference, notes, created_at from payments where sale_id = $1 order by created_at", [sid]),
    q.query<SaleView["returns"][number]>("select id, return_no, kind, reason, refund_amount, created_by_name, created_at from sale_returns where sale_id = $1 order by created_at", [sid]),
  ]);
  return { ...rows[0], items, payments, returns };
}

export interface SaleListRow {
  id: string;
  bill_no: string;
  channel: string;
  order_id: string | null;
  status: string;
  document_type: string;
  customer_name: string;
  customer_phone: string;
  total: number;
  payment_status: string;
  methods: string | null;
  items: number;
  cashier_name: string;
  created_at: string;
}

export async function listSales(
  q: Queryable,
  f: { search?: string; from?: string; to?: string; channel?: string; method?: string; product?: string; status?: string; cashierId?: string; limit?: number; offset?: number } = {},
) {
  const w = whereBuilder();
  if (f.search) {
    const s = `%${f.search.trim()}%`;
    w.add("(s.bill_no ilike ? or s.customer_name ilike ? or s.customer_phone like ? or coalesce(s.order_id,'') ilike ?)", s, s, s, s);
  }
  if (f.from) w.add("ist_date(s.created_at) >= ?::date", f.from);
  if (f.to) w.add("ist_date(s.created_at) <= ?::date", f.to);
  if (f.channel === "ONLINE" || f.channel === "OFFLINE") w.add("s.channel = ?", f.channel);
  if (f.status) w.add("s.status = ?", f.status);
  if (f.cashierId) w.add("s.cashier_id = ?", f.cashierId);
  if (f.method) w.add("exists (select 1 from payments p where p.sale_id = s.id and p.method = ? and p.direction = 'in')", f.method);
  if (f.product) {
    const s = `%${f.product.trim()}%`;
    w.add("exists (select 1 from sale_items i where i.sale_id = s.id and (i.product_name ilike ? or i.sku ilike ?))", s, s);
  }
  const limit = w.param(Math.min(f.limit ?? 50, 500));
  const offset = w.param(f.offset ?? 0);
  return q.query<SaleListRow>(
    `select s.id, s.bill_no, s.channel, s.order_id, s.status, s.document_type, s.customer_name, s.customer_phone, s.total, s.payment_status,
            (select string_agg(distinct p.method, '+') from payments p where p.sale_id = s.id and p.direction = 'in') as methods,
            (select coalesce(sum(i.qty), 0)::int from sale_items i where i.sale_id = s.id) as items,
            s.cashier_name, s.created_at
     from sales s ${w.sql} order by s.created_at desc limit ${limit} offset ${offset}`,
    w.params,
  );
}

// ------------------------------------------------------------------ returns & voids

export interface ReturnInput {
  items: { saleItemId: string; qty: number; restock?: boolean }[];
  reason: string;
  refundMethod: PosPaymentMethod | "razorpay" | "none";
  clientTxnId?: string;
}

/**
 * Controlled reversal: never edits the original bill. Creates a return document, puts stock back
 * (into the batches it came from) and records the refund payment. Can be partial.
 */
export async function returnSale(q: Queryable, actor: Actor, saleId: string, input: ReturnInput, kind: "return" | "void" = "return", movementType: "RETURN" | "CANCELLATION" = "RETURN") {
  if (kind === "return" && !can(actor.role, "sales.return")) throw forbidden("Only a manager or the owner can process returns");
  if (kind === "void" && !can(actor.role, "sales.void") && actor.id !== "system") throw forbidden("Only a manager or the owner can cancel bills");
  const reason = String(input.reason ?? "").trim();
  if (reason.length < 3) throw bad("Enter a reason (at least 3 characters)");
  if (input.clientTxnId) {
    const dup = await q.query<{ id: string }>("select id from sale_returns where client_txn_id = $1", [input.clientTxnId]);
    if (dup[0]) return { returnId: dup[0].id, duplicate: true };
  }
  const sales = await q.query<{ id: string; bill_no: string; status: string; channel: string; order_id: string | null; delivery: number; round_off: number }>(
    "select id, bill_no, status, channel, order_id, delivery, round_off from sales where id = $1 for update",
    [saleId],
  );
  const sale = sales[0];
  if (!sale) throw notFound("Bill not found");
  if (sale.status === "cancelled" || sale.status === "returned") throw conflict("This bill has already been fully returned/cancelled");

  const items = await q.query<SaleItemView & { unit_cost: number | null }>("select * from sale_items where sale_id = $1 order by line_no for update", [saleId]);
  const byId = new Map(items.map((i) => [i.id, i]));
  const wanted = new Map<string, { qty: number; restock: boolean }>();
  for (const r of input.items ?? []) {
    const qty = Number(r.qty);
    if (!Number.isInteger(qty) || qty <= 0) continue;
    if (!byId.has(r.saleItemId)) throw bad("That item is not on this bill");
    const prev = wanted.get(r.saleItemId);
    wanted.set(r.saleItemId, { qty: (prev?.qty ?? 0) + qty, restock: r.restock !== false });
  }
  if (!wanted.size) throw bad("Choose at least one item and quantity to return");

  const s = await getSettings(q);
  const returnId = newId();
  const returnNo = await nextDocumentNo(q, "return", `${s.business.billPrefix}CN`);
  let refund = 0;
  const lines: { item: (typeof items)[number]; qty: number; restock: boolean; amount: number; taxable: number; tax: number }[] = [];
  for (const [itemId, w] of wanted) {
    const it = byId.get(itemId)!;
    const left = it.qty - it.returned_qty;
    if (w.qty > left) throw bad(`Only ${left} of ${it.product_name} can still be returned`);
    // refund the exact share actually paid for those units (after discount, incl. tax); the last unit absorbs rounding
    const fullyBack = w.qty === left;
    const paidPaise = toPaise(it.line_total);
    const prevBack = Math.round((paidPaise * it.returned_qty) / it.qty);
    const amount = fullyBack ? paidPaise - prevBack : Math.round((paidPaise * w.qty) / it.qty);
    const taxable = Math.round((toPaise(it.taxable_value) * w.qty) / it.qty);
    const tax = Math.round((toPaise(it.tax_amount) * w.qty) / it.qty);
    refund += amount;
    lines.push({ item: it, qty: w.qty, restock: w.restock, amount, taxable, tax });
  }
  const everythingBack = items.every((it) => it.qty - it.returned_qty === (wanted.get(it.id)?.qty ?? 0));
  // a full return/cancel also gives back delivery & rounding
  if (everythingBack) refund += toPaise(sale.delivery) + toPaise(sale.round_off);
  refund = Math.max(0, refund);

  await q.query(
    `insert into sale_returns (id, return_no, sale_id, kind, reason, refund_amount, refund_method, client_txn_id, created_by, created_by_name)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [returnId, returnNo, saleId, kind, reason.slice(0, 300), toRupees(refund), input.refundMethod, input.clientTxnId ?? null, actor.id, actor.name],
  );
  for (const l of lines) {
    await q.query(
      `insert into sale_return_items (id, return_id, sale_item_id, qty, refund_amount, taxable_value, tax_amount, unit_cost, restock)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [newId(), returnId, l.item.id, l.qty, toRupees(l.amount), toRupees(l.taxable), toRupees(l.tax), l.item.unit_cost, l.restock],
    );
    await q.query("update sale_items set returned_qty = returned_qty + $2 where id = $1", [l.item.id, l.qty]);
    if (l.restock) {
      const allocations = await returnableAllocations(q, l.item.id, l.qty);
      await addStock(q, {
        variantId: l.item.variant_id,
        qty: l.qty,
        type: movementType,
        refType: "return",
        refId: returnId,
        refLine: l.item.id,
        actor,
        unitCost: l.item.unit_cost,
        allocations,
        note: `${kind === "void" ? "Cancelled" : "Returned"} from ${sale.bill_no}: ${reason.slice(0, 120)}`,
      });
    }
  }
  if (refund > 0 && input.refundMethod !== "none") {
    await q.query(
      `insert into payments (id, sale_id, order_id, return_id, direction, method, amount, status, recorded_by, notes)
       values ($1,$2,$3,$4,'out',$5,$6,'refunded',$7,$8)`,
      [newId(), saleId, sale.order_id, returnId, input.refundMethod, toRupees(refund), actor.id, `Refund for ${returnNo}`],
    );
  }
  const status = everythingBack ? (kind === "void" ? "cancelled" : "returned") : "partially_returned";
  await q.query("update sales set status = $2, payment_status = case when $3 then 'refunded' else payment_status end where id = $1", [
    saleId,
    status,
    everythingBack && refund > 0 && input.refundMethod !== "none",
  ]);
  await audit(q, actor, kind === "void" ? "sale.cancelled" : "sale.returned", { type: "sale", id: saleId }, `${returnNo} for ${sale.bill_no}: ₹${toRupees(refund)} refund · ${reason.slice(0, 100)}`, {
    returnNo,
    refund: toRupees(refund),
    refundMethod: input.refundMethod,
    items: lines.map((l) => ({ name: l.item.product_name, qty: l.qty, restock: l.restock })),
  });
  return { returnId, returnNo, refund: toRupees(refund), duplicate: false };
}

/** Cancels a whole bill (all remaining items back to stock). */
export async function voidSale(q: Queryable, actor: Actor, saleId: string, reason: string, refundMethod: ReturnInput["refundMethod"], movementType: "RETURN" | "CANCELLATION" = "CANCELLATION") {
  const items = await q.query<{ id: string; qty: number; returned_qty: number }>("select id, qty, returned_qty from sale_items where sale_id = $1", [saleId]);
  const remaining = items.filter((i) => i.qty > i.returned_qty).map((i) => ({ saleItemId: i.id, qty: i.qty - i.returned_qty, restock: true }));
  if (!remaining.length) throw conflict("Nothing left to cancel on this bill");
  return returnSale(q, actor, saleId, { items: remaining, reason, refundMethod }, "void", movementType);
}
