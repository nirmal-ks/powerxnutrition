"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { siteConfig } from "@/config/site";
import { categories, categoryUrl } from "@/lib/catalog";
import { cn } from "@/lib/format";
import { useCart } from "../cart/CartProvider";
import { CartIcon, CloseIcon, MenuIcon, SearchIcon } from "../ui/Icons";
import { Logo } from "../ui/Logo";
import { ShopStatus } from "../ui/ShopStatus";
import { ThemeToggle } from "../ui/ThemeToggle";
import { OPEN_SEARCH_EVENT } from "./MobileTabBar";
import { SearchBox, type SearchItem } from "./SearchBox";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Shop" },
  { href: "/shop/whey-protein", label: "Protein" },
  { href: "/shop/creatine", label: "Creatine" },
  { href: "/shop/mass-gainer", label: "Gainers" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function Header({ searchItems }: { searchItems: SearchItem[] }) {
  const { count, openDrawer, bump, ready } = useCart();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  // The Search tab in the phone bottom bar opens the header search.
  useEffect(() => {
    const open = () => setSearchOpen(true);
    window.addEventListener(OPEN_SEARCH_EVENT, open);
    return () => window.removeEventListener(OPEN_SEARCH_EVENT, open);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
  }, [menuOpen]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-all duration-300",
        scrolled ? "border-b border-white/8 bg-ink/80 backdrop-blur-xl" : "bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:h-20 sm:px-6">
        <button className="-ml-2 p-2 lg:hidden" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
          <MenuIcon size={24} />
        </button>
        <Logo />
        <Link href="/contact" className="ml-2 hidden rounded-full border border-white/10 bg-white/5 px-3 py-1.5 xl:inline-flex" title="Shop hours">
          <ShopStatus showDetail={false} />
        </Link>

        <nav className="ml-6 hidden items-center gap-1 lg:flex" aria-label="Main">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "relative rounded-full px-3.5 py-2 text-sm font-semibold transition-colors",
                isActive(n.href) ? "text-white" : "text-zinc-400 hover:text-white",
              )}
            >
              {n.label}
              <span
                className={cn(
                  "absolute inset-x-3 -bottom-0.5 h-0.5 origin-left rounded-full bg-gradient-to-r from-blood to-gold transition-transform duration-300",
                  isActive(n.href) ? "scale-x-100" : "scale-x-0",
                )}
              />
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <SearchBox items={searchItems} mobileOpen={searchOpen} />
          <button className="p-2 md:hidden" aria-label="Search" onClick={() => setSearchOpen((s) => !s)}>
            <SearchIcon size={22} />
          </button>
          <ThemeToggle />
          <button
            onClick={openDrawer}
            aria-label={`Cart, ${count} items`}
            className="relative flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 transition-colors hover:border-gold/60 hover:bg-gold/10"
          >
            <CartIcon size={20} />
            {ready && count > 0 && (
              <span
                key={bump}
                className="animate-bump absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-blood px-1 text-[0.65rem] font-extrabold text-snow shadow-lg shadow-blood/50"
              >
                {count}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={cn("fixed inset-0 z-50 lg:hidden", menuOpen ? "visible" : "invisible")}
        aria-hidden={!menuOpen}
      >
        <div
          className={cn("absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity", menuOpen ? "opacity-100" : "opacity-0")}
          onClick={() => setMenuOpen(false)}
        />
        <div
          className={cn(
            "absolute inset-y-0 left-0 flex w-[85%] max-w-sm flex-col overflow-y-auto bg-coal p-6 shadow-2xl transition-transform duration-300",
            menuOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex items-center justify-between">
            <Logo />
            <button aria-label="Close menu" onClick={() => setMenuOpen(false)} className="p-2">
              <CloseIcon />
            </button>
          </div>
          <nav className="mt-8 flex flex-col" aria-label="Mobile">
            {NAV.map((n, i) => (
              <Link
                key={n.href}
                href={n.href}
                style={{ transitionDelay: menuOpen ? `${i * 40}ms` : "0ms" }}
                className={cn(
                  "font-display border-b border-white/5 py-3 text-2xl transition-all duration-500",
                  menuOpen ? "translate-x-0 opacity-100" : "-translate-x-6 opacity-0",
                  isActive(n.href) ? "text-gold" : "text-white",
                )}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="mt-6 grid grid-cols-3 gap-2 text-center text-xs font-semibold">
            {[
              ["/track-order", "📦", "Track order"],
              ["/protein-calculator", "🧮", "Protein calc"],
              ["/faq", "❓", "FAQ"],
            ].map(([href, icon, label]) => (
              <Link key={href} href={href} className="rounded-2xl border border-white/10 bg-white/[0.03] px-2 py-3 text-zinc-300 transition hover:border-gold/40">
                <span className="block text-xl">{icon}</span>
                {label}
              </Link>
            ))}
          </div>
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-smoke">Shop hours</p>
            <p className="mt-1 text-sm font-semibold">{siteConfig.contact.hours}</p>
            <ShopStatus className="mt-2 flex flex-wrap" />
          </div>
          <p className="mt-8 text-xs font-bold uppercase tracking-[0.2em] text-smoke">Categories</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {categories.map((c) => (
              <Link key={c.slug} href={categoryUrl(c.slug)} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-300">
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
