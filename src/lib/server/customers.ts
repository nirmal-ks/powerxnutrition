import type { Queryable } from "@/lib/db/adapter";
import { newId } from "@/lib/db/ids";
import { whereBuilder } from "@/lib/db/where";

export const cleanPhone = (v: unknown) => String(v ?? "").replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "").slice(-10);
export const isMobile = (p: string) => /^[6-9]\d{9}$/.test(p);

/** Creates or refreshes a customer by mobile number. Returns the customer id (or null without a valid phone). */
export async function upsertCustomer(
  q: Queryable,
  c: { phone?: string; name?: string; email?: string; address?: Record<string, string> | null },
): Promise<string | null> {
  const phone = cleanPhone(c.phone);
  if (!isMobile(phone)) return null;
  const rows = await q.query<{ id: string }>(
    `insert into customers (id, phone, name, email, address) values ($1,$2,$3,$4,$5)
     on conflict (phone) do update set
       name = case when excluded.name <> '' then excluded.name else customers.name end,
       email = case when excluded.email <> '' then excluded.email else customers.email end,
       address = coalesce(excluded.address, customers.address),
       updated_at = now()
     returning id`,
    [newId(), phone, (c.name ?? "").trim().slice(0, 80), (c.email ?? "").trim().slice(0, 120), c.address ? JSON.stringify(c.address) : null],
  );
  return rows[0].id;
}

export interface CustomerRow {
  id: string;
  phone: string;
  name: string;
  email: string;
  address: Record<string, string> | null;
  created_at: string;
  bills: number;
  online_orders: number;
  offline_bills: number;
  total_spent: number;
  last_purchase: string | null;
}

export async function listCustomers(q: Queryable, f: { search?: string; limit?: number; offset?: number } = {}) {
  const w = whereBuilder();
  if (f.search) {
    const s = `%${f.search.trim()}%`;
    w.add("(c.name ilike ? or c.phone like ? or c.email ilike ?)", s, s, s);
  }
  const limit = w.param(Math.min(f.limit ?? 100, 500));
  const offset = w.param(f.offset ?? 0);
  return q.query<CustomerRow>(
    `select c.id, c.phone, c.name, c.email, c.address, c.created_at,
            count(s.id)::int as bills,
            count(s.id) filter (where s.channel = 'ONLINE')::int as online_orders,
            count(s.id) filter (where s.channel = 'OFFLINE')::int as offline_bills,
            coalesce(sum(s.total) filter (where s.status <> 'cancelled'), 0) as total_spent,
            max(s.created_at) as last_purchase
     from customers c left join sales s on s.customer_id = c.id
     ${w.sql}
     group by c.id order by max(s.created_at) desc nulls last, c.created_at desc
     limit ${limit} offset ${offset}`,
    w.params,
  );
}
