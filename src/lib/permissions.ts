/**
 * Role-based access control. Shared by server (enforcement) and UI (hiding buttons/menus).
 * The server is the source of truth: every admin API route checks a permission from here.
 */
export type Role = "owner" | "manager" | "cashier" | "inventory";

export const ROLES: { id: Role; label: string; description: string }[] = [
  { id: "owner", label: "Owner", description: "Everything: settings, tax, staff, profit reports" },
  { id: "manager", label: "Manager", description: "Runs the shop: orders, billing, stock, purchases, expenses, returns" },
  { id: "cashier", label: "Cashier", description: "Billing (POS), receipts, small discounts" },
  { id: "inventory", label: "Inventory staff", description: "Receive stock, purchases, product lookup" },
];

export type Permission =
  | "dashboard.view"
  | "reports.sales" // sales totals by product / channel / payment
  | "reports.financial" // cost, gross & operating profit, stock value at cost
  | "sales.create"
  | "sales.view"
  | "sales.return"
  | "sales.void"
  | "discount.extended" // above the cashier discount limit
  | "orders.manage"
  | "products.view"
  | "products.edit"
  | "products.cost" // see / change purchase cost of products
  | "images.review"
  | "inventory.view"
  | "inventory.adjust"
  | "purchases.create"
  | "purchases.confirm"
  | "purchases.override_duplicate"
  | "suppliers.manage"
  | "customers.view"
  | "expenses.manage"
  | "coupons.manage"
  | "reviews.manage"
  | "audit.view"
  | "settings.manage"
  | "tax.manage"
  | "staff.manage";

const ALL: Permission[] = [
  "dashboard.view", "reports.sales", "reports.financial", "sales.create", "sales.view", "sales.return", "sales.void",
  "discount.extended", "orders.manage", "products.view", "products.edit", "products.cost", "images.review",
  "inventory.view", "inventory.adjust", "purchases.create", "purchases.confirm", "purchases.override_duplicate",
  "suppliers.manage", "customers.view", "expenses.manage", "coupons.manage", "reviews.manage", "audit.view",
  "settings.manage", "tax.manage", "staff.manage",
];

const MATRIX: Record<Role, Permission[]> = {
  owner: ALL,
  manager: ALL.filter((p) => !["settings.manage", "tax.manage", "staff.manage", "purchases.override_duplicate"].includes(p)),
  cashier: ["dashboard.view", "sales.create", "sales.view", "products.view", "customers.view"],
  inventory: [
    "dashboard.view", "products.view", "inventory.view", "purchases.create", "purchases.confirm", "suppliers.manage",
  ],
};

export const can = (role: Role | undefined | null, perm: Permission) => Boolean(role && MATRIX[role]?.includes(perm));

export const permissionsOf = (role: Role) => [...MATRIX[role]];

export const isRole = (v: unknown): v is Role => v === "owner" || v === "manager" || v === "cashier" || v === "inventory";

export interface Actor {
  id: string;
  name: string;
  role: Role;
}

/** Used by background/system work (seeding, gateway webhooks). Never given to a logged-in person. */
export const SYSTEM_ACTOR: Actor = { id: "system", name: "System", role: "owner" };
