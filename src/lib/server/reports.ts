import type { Queryable } from "@/lib/db/adapter";

/**
 * Financial definitions used everywhere (dashboard, reports, CSV exports, tests):
 *
 *  Net sales      = (bill value after discounts, EXCLUDING GST) + delivery charges (excl. GST)
 *                   − value of returns/cancellations (excl. GST) dated in the period.
 *  COGS           = Σ quantity sold × unit cost frozen on each sale line (historical weighted-average
 *                   purchase cost) − cost of returned units that went back into stock.
 *  Gross profit   = Net sales − COGS.
 *  Operating exp. = Σ RECORDED expenses (not voided) in the period. Stock purchases are NOT expenses.
 *  Est. operating profit = Gross profit − recorded operating expenses ("estimated": only what's recorded).
 *  Collections    = money actually received (payments marked received/verified) − refunds paid out.
 *
 * Sales are counted on the day the sale was booked (POS bill / online order reaching the stock stage);
 * returns on the day they were processed. Unsold stock is never profit: it is shown at cost separately.
 */
export type Channel = "ONLINE" | "OFFLINE" | "";

export interface Period {
  from: string; // YYYY-MM-DD (IST)
  to: string;
  channel?: Channel;
}

const ch = (c?: Channel) => (c === "ONLINE" || c === "OFFLINE" ? c : null);

export async function salesSummary(q: Queryable, p: Period) {
  const c = ch(p.channel);
  const [s] = await q.query<{
    bills: number;
    online_bills: number;
    offline_bills: number;
    gross: number;
    discount: number;
    taxable: number;
    tax: number;
    delivery: number;
    total: number;
    online_total: number;
    offline_total: number;
  }>(
    `select count(*)::int as bills,
            count(*) filter (where channel = 'ONLINE')::int as online_bills,
            count(*) filter (where channel = 'OFFLINE')::int as offline_bills,
            coalesce(sum(subtotal),0) as gross, coalesce(sum(discount),0) as discount, coalesce(sum(taxable_value),0) as taxable,
            coalesce(sum(tax_total),0) as tax, coalesce(sum(delivery),0) as delivery, coalesce(sum(total),0) as total,
            coalesce(sum(total) filter (where channel = 'ONLINE'),0) as online_total,
            coalesce(sum(total) filter (where channel = 'OFFLINE'),0) as offline_total
     from sales where ist_date(created_at) between $1::date and $2::date and ($3::text is null or channel = $3)`,
    [p.from, p.to, c],
  );
  const [cogs] = await q.query<{ cogs: number; missing_units: number; missing_value: number; units: number }>(
    `select coalesce(sum(i.qty * i.unit_cost),0) as cogs,
            coalesce(sum(i.qty) filter (where i.unit_cost is null),0)::int as missing_units,
            coalesce(sum(i.taxable_value) filter (where i.unit_cost is null),0) as missing_value,
            coalesce(sum(i.qty),0)::int as units
     from sale_items i join sales s on s.id = i.sale_id
     where ist_date(s.created_at) between $1::date and $2::date and ($3::text is null or s.channel = $3)`,
    [p.from, p.to, c],
  );
  const [ret] = await q.query<{ count: number; taxable: number; tax: number; refund: number; cogs_back: number; units: number }>(
    `select count(distinct r.id)::int as count, coalesce(sum(ri.taxable_value),0) as taxable, coalesce(sum(ri.tax_amount),0) as tax,
            coalesce(sum(ri.refund_amount),0) as refund,
            coalesce(sum(ri.qty * ri.unit_cost) filter (where ri.restock),0) as cogs_back,
            coalesce(sum(ri.qty),0)::int as units
     from sale_returns r join sale_return_items ri on ri.return_id = r.id join sales s on s.id = r.sale_id
     where ist_date(r.created_at) between $1::date and $2::date and ($3::text is null or s.channel = $3)`,
    [p.from, p.to, c],
  );
  // delivery refunded on full cancellations (not in return items)
  const [retDelivery] = await q.query<{ delivery: number }>(
    `select coalesce(sum(s.delivery),0) as delivery from sale_returns r join sales s on s.id = r.sale_id
     where s.status in ('returned','cancelled') and r.created_at = (select max(r2.created_at) from sale_returns r2 where r2.sale_id = s.id)
       and ist_date(r.created_at) between $1::date and $2::date and ($3::text is null or s.channel = $3)`,
    [p.from, p.to, c],
  );
  const [exp] = await q.query<{ total: number; count: number }>(
    "select coalesce(sum(amount),0) as total, count(*)::int as count from expenses where not voided and expense_date between $1::date and $2::date",
    [p.from, p.to],
  );

  const r2 = (n: number) => Math.round(n * 100) / 100;
  const netSales = r2(s.taxable + s.delivery - ret.taxable - retDelivery.delivery);
  const cogsNet = r2(cogs.cogs - ret.cogs_back);
  const grossProfit = r2(netSales - cogsNet);
  return {
    period: p,
    bills: s.bills,
    onlineBills: s.online_bills,
    offlineBills: s.offline_bills,
    grossSales: s.gross,
    discounts: s.discount,
    taxCollected: r2(s.tax - ret.tax),
    delivery: s.delivery,
    billedTotal: s.total,
    onlineTotal: s.online_total,
    offlineTotal: s.offline_total,
    returns: { count: ret.count, units: ret.units, value: r2(ret.taxable + retDelivery.delivery), refunds: ret.refund },
    unitsSold: cogs.units - ret.units,
    netSales,
    cogs: cogsNet,
    grossProfit,
    grossMarginPct: netSales ? r2((grossProfit / netSales) * 100) : 0,
    missingCost: { units: cogs.missing_units, salesValue: cogs.missing_value },
    expenses: exp.total,
    expenseCount: exp.count,
    estimatedOperatingProfit: r2(grossProfit - exp.total),
  };
}

/** Money actually collected, by method (cash basis). */
export async function collections(q: Queryable, p: Period) {
  const c = ch(p.channel);
  return q.query<{ method: string; received: number; refunded: number; net: number; count: number; pending: number }>(
    `select p.method,
            coalesce(sum(p.amount) filter (where p.direction = 'in' and p.status in ('received','verified')),0) as received,
            coalesce(sum(p.amount) filter (where p.direction = 'out'),0) as refunded,
            coalesce(sum(case when p.direction = 'in' and p.status in ('received','verified') then p.amount when p.direction = 'out' then -p.amount else 0 end),0) as net,
            count(*) filter (where p.direction = 'in' and p.status in ('received','verified'))::int as count,
            coalesce(sum(p.amount) filter (where p.direction = 'in' and p.status in ('pending','verifying')),0) as pending
     from payments p
     left join sales s on s.id = p.sale_id
     left join orders o on o.id = p.order_id
     where ist_date(p.updated_at) between $1::date and $2::date
       and ($3::text is null or coalesce(s.channel, case when p.order_id is not null then 'ONLINE' end) = $3)
     group by p.method order by net desc`,
    [p.from, p.to, c],
  );
}

export async function productSales(q: Queryable, p: Period & { limit?: number }) {
  const c = ch(p.channel);
  return q.query<{ variant_id: string; product_name: string; variant_label: string; sku: string; qty: number; returned: number; net_sales: number; cogs: number; profit: number; missing_cost: boolean }>(
    `select i.variant_id, max(i.product_name) as product_name, max(i.variant_label) as variant_label, max(i.sku) as sku,
            sum(i.qty)::int as qty, sum(i.returned_qty)::int as returned,
            round(sum(i.taxable_value * (i.qty - i.returned_qty)::numeric / i.qty), 2) as net_sales,
            round(sum((i.qty - i.returned_qty) * coalesce(i.unit_cost, 0)), 2) as cogs,
            round(sum(i.taxable_value * (i.qty - i.returned_qty)::numeric / i.qty) - sum((i.qty - i.returned_qty) * coalesce(i.unit_cost, 0)), 2) as profit,
            bool_or(i.unit_cost is null) as missing_cost
     from sale_items i join sales s on s.id = i.sale_id
     where ist_date(s.created_at) between $1::date and $2::date and ($3::text is null or s.channel = $3)
     group by i.variant_id order by sum(i.qty - i.returned_qty) desc, net_sales desc limit $4`,
    [p.from, p.to, c, p.limit ?? 500],
  );
}

/** Day-by-day online vs offline (billed totals incl. GST, and net sales excl. GST). */
export async function dailyChannels(q: Queryable, p: Period) {
  return q.query<{ day: string; online: number; offline: number; online_bills: number; offline_bills: number; net_sales: number; cogs: number }>(
    `with d as (select generate_series($1::date, $2::date, interval '1 day')::date as day)
     select to_char(d.day, 'YYYY-MM-DD') as day,
            coalesce(sum(s.total) filter (where s.channel = 'ONLINE'),0) as online,
            coalesce(sum(s.total) filter (where s.channel = 'OFFLINE'),0) as offline,
            count(s.id) filter (where s.channel = 'ONLINE')::int as online_bills,
            count(s.id) filter (where s.channel = 'OFFLINE')::int as offline_bills,
            coalesce(sum(s.taxable_value + s.delivery),0) as net_sales,
            coalesce(sum((select sum(i.qty * coalesce(i.unit_cost,0)) from sale_items i where i.sale_id = s.id)),0) as cogs
     from d left join sales s on ist_date(s.created_at) = d.day
     group by d.day order by d.day`,
    [p.from, p.to],
  );
}

export async function expenseByCategory(q: Queryable, p: Period) {
  return q.query<{ category: string; total: number; count: number }>(
    "select category, sum(amount) as total, count(*)::int as count from expenses where not voided and expense_date between $1::date and $2::date group by category order by total desc",
    [p.from, p.to],
  );
}

/** Stock value at COST (the money tied up) vs RETAIL (what it could sell for). Never counted as profit. */
export async function stockValuation(q: Queryable) {
  const [r] = await q.query<{ units: number; cost_value: number; retail_value: number; no_cost_units: number; low: number; out: number; skus: number }>(
    `select coalesce(sum(greatest(v.stock,0)),0)::int as units,
            coalesce(sum(greatest(v.stock,0) * coalesce(v.avg_cost,0)),0) as cost_value,
            coalesce(sum(greatest(v.stock,0) * v.price),0) as retail_value,
            coalesce(sum(greatest(v.stock,0)) filter (where v.avg_cost is null),0)::int as no_cost_units,
            count(*) filter (where v.stock <= v.min_stock and v.stock > 0)::int as low,
            count(*) filter (where v.stock <= 0)::int as out,
            count(*)::int as skus
     from product_variants v join products p on p.id = v.product_id where v.active and p.status <> 'archived'`,
  );
  return r;
}

export async function lowStock(q: Queryable, limit = 20) {
  return q.query<{ variant_id: string; slug: string; name: string; label: string; flavour: string; stock: number; min_stock: number }>(
    `select v.id as variant_id, p.slug, p.name, v.label, v.flavour, v.stock, v.min_stock
     from product_variants v join products p on p.id = v.product_id
     where v.active and p.status <> 'archived' and v.stock <= v.min_stock
     order by v.stock asc, p.name limit $1`,
    [limit],
  );
}

export async function expiringSoon(q: Queryable, days: number, limit = 20) {
  return q.query<{ batch_id: string; name: string; label: string; batch_no: string; expiry_date: string; qty_remaining: number; days_left: number }>(
    `select b.id as batch_id, p.name, v.label, b.batch_no, b.expiry_date, b.qty_remaining, (b.expiry_date - ist_date(now()))::int as days_left
     from batches b join product_variants v on v.id = b.variant_id join products p on p.id = v.product_id
     where b.qty_remaining > 0 and b.expiry_date is not null and b.expiry_date <= ist_date(now()) + $1::int
     order by b.expiry_date limit $2`,
    [days, limit],
  );
}

export async function pendingWork(q: Queryable) {
  const [r] = await q.query<{ invoices: number; images: number; drafts: number; new_orders: number; upi_verify: number; draft_products: number }>(
    `select (select count(*) from invoice_imports where status = 'extracted')::int as invoices,
            (select count(*) from products where status <> 'archived' and image_status <> 'APPROVED')::int as images,
            (select count(*) from purchases where status = 'draft')::int as drafts,
            (select count(*) from orders where status = 'new')::int as new_orders,
            (select count(*) from orders where payment_status = 'verifying' and status <> 'cancelled')::int as upi_verify,
            (select count(*) from products where status = 'draft')::int as draft_products`,
  );
  return r;
}

export async function recentPurchases(q: Queryable, limit = 6) {
  return q.query<{ id: string; purchase_no: string; supplier_name: string; total: number; status: string; created_at: string; units: number }>(
    `select p.id, p.purchase_no, s.name as supplier_name, p.total, p.status, p.created_at,
            (select coalesce(sum(qty),0) from purchase_items i where i.purchase_id = p.id)::int as units
     from purchases p join suppliers s on s.id = p.supplier_id order by p.created_at desc limit $1`,
    [limit],
  );
}

/** IST "today" and helpers for date ranges. */
export const todayIST = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
export const daysAgoIST = (n: number) => new Date(Date.now() + 330 * 60_000 - n * 86400_000).toISOString().slice(0, 10);
export const monthStartIST = () => todayIST().slice(0, 8) + "01";

export function parsePeriod(sp: URLSearchParams | Record<string, string | undefined>): Period {
  const get = (k: string) => (sp instanceof URLSearchParams ? sp.get(k) : sp[k]) ?? "";
  const ok = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);
  let from = get("from");
  let to = get("to");
  if (!ok(from)) from = todayIST();
  if (!ok(to)) to = from > todayIST() ? from : todayIST();
  if (from > to) [from, to] = [to, from];
  const c = get("channel");
  return { from, to, channel: c === "ONLINE" || c === "OFFLINE" ? c : "" };
}

export function toCsv(rows: Record<string, unknown>[], columns?: { key: string; label: string }[]) {
  const cols = columns ?? (rows[0] ? Object.keys(rows[0]).map((k) => ({ key: k, label: k })) : []);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    // also neutralise spreadsheet formula injection
    const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? `'${s}` : s;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return "﻿" + [cols.map((c) => esc(c.label)).join(","), ...rows.map((r) => cols.map((c) => esc(r[c.key])).join(","))].join("\r\n");
}
