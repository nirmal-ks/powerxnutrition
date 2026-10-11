import { siteConfig } from "@/config/site";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { BackToTop } from "@/components/layout/BackToTop";
import { CartProvider } from "@/components/cart/CartProvider";
import { CartToast } from "@/components/cart/CartToast";
import { Intro } from "@/components/intro/Intro";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { FloatingWhatsApp } from "@/components/layout/FloatingWhatsApp";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { MobileBarSpacer, MobileTabBar } from "@/components/layout/MobileTabBar";
import { SideGym } from "@/components/layout/SideGym";
import { JsonLd } from "@/components/seo/JsonLd";
import { RevealObserver } from "@/components/ui/RevealObserver";
import type { SearchItem } from "@/components/layout/SearchBox";
import { inStock, minPrice } from "@/lib/catalog";
import { schemaOpeningHours } from "@/lib/shop-hours";
import { getCatalog } from "@/lib/store";

const storeJsonLd = {
  "@context": "https://schema.org",
  "@type": "Store",
  name: siteConfig.name,
  slogan: siteConfig.tagline,
  url: siteConfig.url,
  telephone: `+91${siteConfig.contact.phone}`,
  email: siteConfig.contact.email,
  image: `${siteConfig.url}/opengraph-image`,
  priceRange: "₹₹",
  address: {
    "@type": "PostalAddress",
    streetAddress: `${siteConfig.contact.address.line1}, ${siteConfig.contact.address.line2}`,
    addressLocality: siteConfig.contact.address.city,
    addressRegion: siteConfig.contact.address.state,
    postalCode: siteConfig.contact.address.pincode,
    addressCountry: "IN",
  },
  geo: { "@type": "GeoCoordinates", latitude: siteConfig.contact.geo.lat, longitude: siteConfig.contact.geo.lng },
  hasMap: siteConfig.contact.mapsUrl,
  openingHours: schemaOpeningHours(),
  paymentAccepted: "Cash, UPI",
  currenciesAccepted: "INR",
};

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  // Small list for instant search suggestions in the header (no request per keystroke).
  const searchItems: SearchItem[] = (await getCatalog()).map((p) => ({
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    category: p.category,
    image: p.image,
    price: minPrice(p),
    inStock: inStock(p),
    featured: p.featured,
    keywords: p.variants.map((v) => v.label).join(" "),
  }));

  return (
    <CartProvider>
      <Intro />
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-gold focus:px-4 focus:py-2 focus:text-black">
        Skip to content
      </a>
      <AnnouncementBar />
      <Header searchItems={searchItems} />
      <main id="main">{children}</main>
      <Footer />
      <MobileBarSpacer />
      <MobileTabBar />
      <CartDrawer />
      <CartToast />
      <FloatingWhatsApp />
      <BackToTop />
      <SideGym />
      <RevealObserver />
      <JsonLd data={storeJsonLd} />
    </CartProvider>
  );
}
