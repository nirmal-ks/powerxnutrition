import { ExpensesView } from "@/components/admin/ExpensesView";
import { NoAccess, PageHeader } from "@/components/admin/ui";
import { pageAccess } from "@/lib/page-auth";
import { EXPENSE_CATEGORIES } from "@/lib/server/expenses";

export const metadata = { title: "Expenses" };

export default async function ExpensesPage() {
  const { allowed } = await pageAccess("expenses.manage");
  if (!allowed) return <NoAccess />;
  return (
    <div>
      <PageHeader title="Expenses" subtitle="Rent, electricity, salaries, transport, packaging… Stock purchases are NOT expenses here (they become cost when sold)." />
      <ExpensesView categories={EXPENSE_CATEGORIES.map((c) => ({ id: c.id, label: c.label }))} />
    </div>
  );
}
