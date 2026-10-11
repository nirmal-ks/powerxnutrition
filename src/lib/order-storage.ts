import type { Order } from "@/types";

/** The browser keeps a copy of the customer's own orders so the confirmation page works without a login. */
export const orderStorageKey = (id: string) => `px_order_${id}`;

export function loadLocalOrder(id: string): Order | null {
  try {
    const raw = sessionStorage.getItem(orderStorageKey(id)) ?? localStorage.getItem(orderStorageKey(id));
    return raw ? (JSON.parse(raw) as Order) : null;
  } catch {
    return null;
  }
}

/** Orders placed from this browser, newest first. */
export function listLocalOrders(): Order[] {
  try {
    const out: Order[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith("px_order_")) continue;
      const o = JSON.parse(localStorage.getItem(key) || "null") as Order | null;
      if (o?.id && o.customer?.phone) out.push(o);
    }
    return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10);
  } catch {
    return [];
  }
}

export function saveLocalOrder(order: Order) {
  try {
    sessionStorage.setItem(orderStorageKey(order.id), JSON.stringify(order));
    localStorage.setItem(orderStorageKey(order.id), JSON.stringify(order));
  } catch {}
}
