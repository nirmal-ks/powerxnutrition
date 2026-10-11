"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/format";
import { can, ROLES, type Actor, type Permission } from "@/lib/permissions";
import { BoltIcon, BoxIcon, CartIcon, ClockIcon, CloseIcon, DumbbellIcon, GridIcon, HomeIcon, MenuIcon, PlusIcon, ShieldIcon, StarIcon, TagIcon, TruckIcon } from "../ui/Icons";

type Item = { href: string; label: string; icon: typeof HomeIcon; perm: Permission | Permission[]; badge?: number };

export interface NavCounts {
  newOrders: number;
  images: number;
  invoices: number;
  drafts: number;
}

const groups = (c: NavCounts): { title: string; items: Item[] }[] => [
  {
    title: "",
    items: [
      { href: "/admin", label: "Dashboard", icon: HomeIcon, perm: "dashboard.view" },
      { href: "/admin/sales/new", label: "New bill (POS)", icon: BoltIcon, perm: "sales.create" },
    ],
  },
  {
    title: "Sell",
    items: [
      { href: "/admin/orders", label: "Online orders", icon: CartIcon, perm: "orders.manage", badge: c.newOrders },
      { href: "/admin/sales", label: "Bills & returns", icon: ClockIcon, perm: "sales.view" },
      { href: "/admin/customers", label: "Customers", icon: StarIcon, perm: "customers.view" },
      { href: "/admin/coupons", label: "Coupons", icon: TagIcon, perm: "coupons.manage" },
      { href: "/admin/reviews", label: "Reviews", icon: StarIcon, perm: "reviews.manage" },
    ],
  },
  {
    title: "Stock",
    items: [
      { href: "/admin/inventory", label: "Inventory", icon: BoxIcon, perm: "inventory.view" },
      { href: "/admin/inventory/stock-in", label: "Receive stock", icon: PlusIcon, perm: "purchases.create" },
      { href: "/admin/purchases", label: "Purchases", icon: TruckIcon, perm: "purchases.create", badge: c.drafts },
      { href: "/admin/purchases/import-invoice", label: "Scan invoice (AI)", icon: BoltIcon, perm: "purchases.create", badge: c.invoices },
      { href: "/admin/inventory/import", label: "Excel / CSV import", icon: GridIcon, perm: "purchases.create" },
      { href: "/admin/suppliers", label: "Suppliers", icon: TruckIcon, perm: "suppliers.manage" },
      { href: "/admin/products", label: "Products", icon: DumbbellIcon, perm: "products.view" },
      { href: "/admin/images", label: "Product photos", icon: StarIcon, perm: "images.review", badge: c.images },
    ],
  },
  {
    title: "Money",
    items: [
      { href: "/admin/reports", label: "Reports", icon: GridIcon, perm: "reports.sales" },
      { href: "/admin/expenses", label: "Expenses", icon: TagIcon, perm: "expenses.manage" },
    ],
  },
  {
    title: "Admin",
    items: [
      { href: "/admin/billing", label: "Billing & GST", icon: ShieldIcon, perm: "tax.manage" },
      { href: "/admin/settings", label: "Settings & staff", icon: ShieldIcon, perm: ["settings.manage", "dashboard.view"] },
      { href: "/admin/activity-logs", label: "Activity log", icon: ClockIcon, perm: "audit.view" },
    ],
  },
];

export function AdminNav({ actor, storage, counts }: { actor: Actor; storage: string; counts: NavCounts }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const allowed = (p: Item["perm"]) => (Array.isArray(p) ? p.some((x) => can(actor.role, x)) : can(actor.role, p));

  const logout = async () => {
    await fetch("/api/admin/login", { method: "DELETE" });
    router.replace("/admin/login");
    router.refresh();
  };

  // the most specific menu entry that matches the current page is highlighted
  const best = groups(counts)
    .flatMap((g) => g.items.map((i) => i.href))
    .filter((h) => (h === "/admin" ? pathname === "/admin" : pathname === h || pathname.startsWith(h + "/")))
    .sort((a, b) => b.length - a.length)[0];
  const isActive = (href: string) => href === best;

  const nav = (
    <nav className="flex flex-col gap-0.5">
      {groups(counts).map((g) => {
        const items = g.items.filter((i) => allowed(i.perm));
        if (!items.length) return null;
        return (
          <div key={g.title || "main"} className="mb-2">
            {g.title && <p className="mb-1 mt-2 px-3 text-[0.6rem] font-bold uppercase tracking-[0.25em] text-zinc-500">{g.title}</p>}
            {items.map(({ href, label, icon: Icon, badge }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
                  isActive(href) ? "bg-blood/15 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-white",
                )}
              >
                <Icon size={17} className={isActive(href) ? "text-ember" : ""} />
                <span className="flex-1">{label}</span>
                {!!badge && <span className="rounded-full bg-gold px-1.5 text-[0.65rem] font-bold text-black">{badge}</span>}
              </Link>
            ))}
          </div>
        );
      })}
      <a href="/" target="_blank" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-zinc-400 hover:bg-white/5 hover:text-white">
        ↗ View store
      </a>
      <button onClick={logout} className="mt-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-zinc-500 hover:bg-white/5 hover:text-ember">
        Log out
      </button>
    </nav>
  );

  const roleLabel = ROLES.find((r) => r.id === actor.role)?.label ?? actor.role;

  return (
    <>
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-white/8 bg-[#0b0b0d]/95 px-4 py-3 backdrop-blur lg:hidden">
        <Link href="/admin" className="font-display text-xl italic">
          POWER<span className="text-blood">X</span> <span className="not-italic text-gold">ADMIN</span>
        </Link>
        <div className="flex items-center gap-2">
          {can(actor.role, "sales.create") && pathname !== "/admin/sales/new" && (
            <Link href="/admin/sales/new" className="btn btn-red px-3! py-2! text-xs!">+ Bill</Link>
          )}
          <button onClick={() => setOpen(!open)} aria-label="Menu" aria-expanded={open} className="p-2">{open ? <CloseIcon /> : <MenuIcon />}</button>
        </div>
      </div>
      {open && (
        <div className="fixed inset-x-0 bottom-0 top-[57px] z-40 overflow-y-auto bg-[#0b0b0d] px-4 pb-8 pt-2 lg:hidden">
          <p className="mb-2 px-3 text-xs text-smoke">Signed in as <b className="text-white">{actor.name}</b> · {roleLabel}</p>
          {nav}
        </div>
      )}
      <aside className="sticky top-0 hidden h-dvh flex-col overflow-y-auto border-r border-white/8 bg-coal p-4 lg:flex">
        <span className="font-display px-3 text-2xl italic">POWER<span className="text-blood">X</span></span>
        <span className="mb-4 px-3 text-[0.6rem] font-bold tracking-[0.4em] text-gold">ADMIN PANEL</span>
        {nav}
        <div className="mt-auto space-y-1 rounded-xl border border-white/8 p-3 text-[0.7rem] text-smoke">
          <p>
            <b className="text-white">{actor.name}</b> · {roleLabel}
          </p>
          <p>
            Database: <b className="text-green-400">{storage}</b>
          </p>
        </div>
      </aside>
    </>
  );
}
