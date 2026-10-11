import { siteConfig } from "@/config/site";

export interface LatLng {
  lat: number;
  lng: number;
}

export const isLatLng = (v: unknown): v is LatLng => {
  const p = v as Partial<LatLng> | null;
  return (
    !!p &&
    typeof p.lat === "number" && Number.isFinite(p.lat) && Math.abs(p.lat) <= 90 &&
    typeof p.lng === "number" && Number.isFinite(p.lng) && Math.abs(p.lng) <= 180
  );
};

/** Straight-line (haversine) distance in km. */
export function distanceKm(a: LatLng, b: LatLng) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export const distanceFromShopKm = (p: LatLng) => Math.round(distanceKm(siteConfig.contact.geo, p) * 10) / 10;

export const withinCodRadius = (km: number) => km <= siteConfig.delivery.codRadiusKm;

export const mapsPinUrl = (p: LatLng) => `https://www.google.com/maps?q=${p.lat},${p.lng}`;
