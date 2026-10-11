"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/format";
import { useCart } from "../cart/CartProvider";
import { BoxIcon, CartIcon, GridIcon, HomeIcon, SearchIcon } from "../ui/Icons";

/** Pages that show their own sticky action bar instead of the tab bar. */
const HIDE_ON = ["/checkout", "/product/"];

export const OPEN_SEARCH_EVENT = "px:open-search";

/**
 * App-style bottom navigation for phones. Tapping the tab you're already on scrolls to the top,
 * like native apps do.
 */
export function MobileTabBar() {
  const pathname = usePathname();
  const { count, ready } = useCart();
  if (HIDE_ON.some((p) => pathname.startsWith(p))) return null;

  const tabs = [
    { href: "/", label: "Home", icon: HomeIcon, active: pathname === "/" },
    { href: "/shop", label: "Shop", icon: GridIcon, active: pathname.startsWith("/shop") },
    { href: null, label: "Search", icon: SearchIcon, active: false },
    { href: "/cart", label: "Cart", icon: CartIcon, active: pathname.startsWith("/cart") },
    { href: "/track-order", label: "Orders", icon: BoxIcon, active: pathname.startsWith("/track-order") || pathname.startsWith("/order-success") },
  ];

  return (
    <nav
      aria-label="App navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-coal/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl md:hidden"
    >
      <ul className="grid h-16 grid-cols-5">
        {tabs.map(({ href, label, icon: Icon, active }) => {
          const inner = (
            <>
              <span className={cn("absolute inset-x-5 top-0 h-0.5 rounded-b-full bg-gold transition-opacity", active ? "opacity-100" : "opacity-0")} />
              <span className="relative">
                <Icon size={22} strokeWidth={active ? 2.4 : 1.9} />
                {label === "Cart" && ready && count > 0 && (
                  <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blood px-1 text-[0.6rem] font-extrabold text-snow">
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </span>
              <span className="text-[0.65rem] font-semibold">{label}</span>
            </>
          );
          const cls = cn(
            "relative flex h-full w-full flex-col items-center justify-center gap-1 transition-colors active:scale-95",
            active ? "text-gold" : "text-zinc-400",
          );
          return (
            <li key={label}>
              {href ? (
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => active && window.scrollTo({ top: 0, behavior: "smooth" })}
                  className={cls}
                >
                  {inner}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                    window.dispatchEvent(new Event(OPEN_SEARCH_EVENT));
                  }}
                  className={cls}
                >
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Keeps page content clear of the bottom bars on phones. */
export function MobileBarSpacer() {
  return <div aria-hidden className="theme-dark h-[calc(4.5rem+env(safe-area-inset-bottom))] bg-coal md:hidden" />;
}
