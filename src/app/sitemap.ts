import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";
import { categories, categoryUrl, productUrl } from "@/lib/catalog";
import { getCatalog } from "@/lib/store";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.url;
  const now = new Date();
  const pages = ["", "/shop", "/about", "/contact", "/faq", "/protein-calculator", "/track-order", "/shipping-policy", "/refund-policy", "/privacy-policy", "/terms-and-conditions"];
  const products = await getCatalog();
  return [
    ...pages.map((p) => ({ url: `${base}${p}`, lastModified: now, changeFrequency: "weekly" as const, priority: p === "" ? 1 : p === "/shop" ? 0.9 : 0.4 })),
    ...categories.map((c) => ({ url: `${base}${categoryUrl(c.slug)}`, lastModified: now, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...products.map((p) => ({
      url: `${base}${productUrl(p.slug)}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
      images: p.image ? [p.image.startsWith("http") ? p.image : `${base}${p.image}`] : undefined,
    })),
  ];
}
