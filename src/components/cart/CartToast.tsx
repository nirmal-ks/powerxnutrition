"use client";

import Image from "@/components/ui/Img";
import { useCart } from "./CartProvider";
import { CheckIcon } from "../ui/Icons";

export function CartToast() {
  const { toast, openDrawer } = useCart();
  if (!toast) return null;
  return (
    <div
      key={toast.id}
      role="status"
      className="animate-fade-up fixed inset-x-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-sm items-center gap-3 rounded-2xl border border-white/10 bg-steel/95 p-3 shadow-2xl shadow-black/60 backdrop-blur-xl sm:left-auto sm:right-7 sm:top-24 sm:bottom-auto sm:mx-0"
    >
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-gradient-to-b from-snow to-zinc-200">
        {toast.image && <Image src={toast.image} alt="" fill sizes="48px" className="object-contain p-1 mix-blend-multiply" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-green-400">
          <CheckIcon size={14} /> Added to cart
        </p>
        <p className="truncate text-sm">{toast.title}</p>
      </div>
      <button onClick={openDrawer} className="rounded-full bg-snow px-3 py-1.5 text-xs font-extrabold uppercase text-black hover:bg-gold">
        View
      </button>
    </div>
  );
}
