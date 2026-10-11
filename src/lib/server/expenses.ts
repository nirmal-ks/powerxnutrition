import type { Queryable } from "@/lib/db/adapter";
import { newId } from "@/lib/db/ids";
import { whereBuilder } from "@/lib/db/where";
import type { Actor } from "@/lib/permissions";
import { audit } from "./audit";
import { bad, conflict, notFound } from "./errors";

export const EXPENSE_CATEGORIES = [
  { id: "rent", label: "Rent" },
  { id: "electricity", label: "Electricity" },
  { id: "salary", label: "Salaries & wages" },
  { id: "transport", label: "Transport & courier" },
  { id: "packaging", label: "Packaging" },
  { id: "marketing", label: "Marketing & ads" },
  { id: "internet", label: "Phone & internet" },
  { id: "maintenance", label: "Repairs & maintenance" },
  { id: "bank", label: "Bank / payment charges" },
  { id: "other", label: "Other" },
] as const;

export interface ExpenseRow {
  id: string;
  expense_date: string;
  category: string;
  amount: number;
  description: string;
  payment_method: string;
  receipt_path: string | null;
  created_by_name: string;
  created_at: string;
  voided: boolean;
  void_reason: string | null;
}

/** Operating expenses only. Stock purchases are NOT expenses here — they become cost of goods when sold. */
export async function createExpense(
  q: Queryable,
  actor: Actor,
  raw: { date?: string; category?: string; amount?: number | string; description?: string; paymentMethod?: string; receiptPath?: string | null },
) {
  const date = typeof raw.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : "";
  if (!date) throw bad("Choose the expense date");
  if (date > new Date(Date.now() + 330 * 60_000 + 86400_000).toISOString().slice(0, 10)) throw bad("Expense date can't be in the future");
  const category = String(raw.category ?? "");
  if (!EXPENSE_CATEGORIES.some((c) => c.id === category)) throw bad("Choose a category");
  const amount = Math.round(Number(raw.amount) * 100) / 100;
  if (!(amount > 0) || amount > 10_000_000) throw bad("Enter a valid amount");
  const description = String(raw.description ?? "").trim().slice(0, 300);
  if (category === "other" && description.length < 3) throw bad("Describe the expense");
  const id = newId();
  await q.query(
    `insert into expenses (id, expense_date, category, amount, description, payment_method, receipt_path, created_by, created_by_name)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [id, date, category, amount, description, String(raw.paymentMethod ?? "").slice(0, 20), raw.receiptPath ?? null, actor.id, actor.name],
  );
  await audit(q, actor, "expense.created", { type: "expense", id }, `₹${amount} ${category}${description ? ` – ${description.slice(0, 60)}` : ""} (${date})`);
  return id;
}

/** Expenses are never deleted — a wrong entry is voided with a reason (kept in the audit trail). */
export async function voidExpense(q: Queryable, actor: Actor, id: string, reason: string) {
  if (String(reason ?? "").trim().length < 3) throw bad("Enter a reason");
  const r = await q.query<{ amount: number; category: string; voided: boolean }>("select amount, category, voided from expenses where id = $1 for update", [id]);
  if (!r[0]) throw notFound("Expense not found");
  if (r[0].voided) throw conflict("Already voided");
  await q.query("update expenses set voided = true, voided_by = $2, void_reason = $3 where id = $1", [id, actor.id, reason.trim().slice(0, 200)]);
  await audit(q, actor, "expense.voided", { type: "expense", id }, `Voided ₹${r[0].amount} ${r[0].category}: ${reason.trim().slice(0, 100)}`);
}

export async function listExpenses(q: Queryable, f: { from?: string; to?: string; category?: string; includeVoided?: boolean } = {}) {
  const w = whereBuilder();
  if (f.from) w.add("expense_date >= ?::date", f.from);
  if (f.to) w.add("expense_date <= ?::date", f.to);
  if (f.category) w.add("category = ?", f.category);
  if (!f.includeVoided) w.add("not voided");
  return q.query<ExpenseRow>(
    `select id, expense_date, category, amount, description, payment_method, receipt_path, created_by_name, created_at, voided, void_reason
     from expenses ${w.sql} order by expense_date desc, created_at desc limit 1000`,
    w.params,
  );
}
