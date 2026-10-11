"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { calcTotals } from "@/lib/pricing";
import type { CartItem } from "@/types";

const STORAGE_KEY = "px_cart_v1";

interface Toast {
  id: number;
  title: string;
  image?: string;
}

interface CartContextValue {
  items: CartItem[];
  count: number;
  totals: ReturnType<typeof calcTotals>;
  ready: boolean;
  drawerOpen: boolean;
  bump: number;
  toast: Toast | null;
  openDrawer: () => void;
  closeDrawer: () => void;
  add: (item: Omit<CartItem, "qty">, qty?: number, opts?: { silent?: boolean }) => void;
  setQty: (slug: string, variantId: string, qty: number) => void;
  remove: (slug: string, variantId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const key = (i: { slug: string; variantId: string }) => `${i.slug}::${i.variantId}`;

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [bump, setBump] = useState(0);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Load once on the client
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (Array.isArray(saved)) setItems(saved);
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {}
  }, [items, ready]);

  // Keep tabs in sync
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      try {
        setItems(JSON.parse(e.newValue || "[]"));
      } catch {}
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const add = useCallback<CartContextValue["add"]>((item, qty = 1, opts) => {
    setItems((prev) => {
      const existing = prev.find((i) => key(i) === key(item));
      if (existing) {
        return prev.map((i) =>
          key(i) === key(item) ? { ...i, ...item, qty: Math.min(item.maxQty, i.qty + qty) } : i,
        );
      }
      return [...prev, { ...item, qty: Math.min(item.maxQty, qty) }];
    });
    setBump((b) => b + 1);
    if (!opts?.silent) {
      clearTimeout(toastTimer.current);
      setToast({ id: Date.now(), title: `${item.name} (${item.variantLabel})`, image: item.image });
      toastTimer.current = setTimeout(() => setToast(null), 2800);
    }
  }, []);

  const setQty = useCallback((slug: string, variantId: string, qty: number) => {
    setItems((prev) =>
      prev
        .map((i) => (i.slug === slug && i.variantId === variantId ? { ...i, qty: Math.max(0, Math.min(i.maxQty, qty)) } : i))
        .filter((i) => i.qty > 0),
    );
  }, []);

  const remove = useCallback((slug: string, variantId: string) => {
    setItems((prev) => prev.filter((i) => !(i.slug === slug && i.variantId === variantId)));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(() => {
    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    return {
      items,
      count: items.reduce((s, i) => s + i.qty, 0),
      totals: calcTotals(subtotal),
      ready,
      drawerOpen,
      bump,
      toast,
      openDrawer: () => setDrawerOpen(true),
      closeDrawer: () => setDrawerOpen(false),
      add,
      setQty,
      remove,
      clear,
    };
  }, [items, ready, drawerOpen, bump, toast, add, setQty, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
