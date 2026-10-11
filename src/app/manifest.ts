import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

/** Lets customers "Add to Home screen" and open the shop full-screen like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.name,
    short_name: siteConfig.shortName,
    description: siteConfig.description,
    id: "/",
    start_url: "/?source=app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#070707",
    theme_color: "#070707",
    categories: ["shopping", "health", "fitness"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Shop", url: "/shop", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Track order", url: "/track-order", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Cart", url: "/cart", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
