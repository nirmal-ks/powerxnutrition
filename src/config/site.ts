/**
 * ONE place for all store settings.
 * Values come from environment variables (see .env.example) with defaults below.
 * NEXT_PUBLIC_* values are baked in at build time — redeploy after changing them.
 */
const env = (value: string | undefined, fallback: string) => (value && value.trim() ? value.trim() : fallback);
const num = (value: string | undefined, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) && value !== undefined && value !== "" ? n : fallback;
};

export const siteConfig = {
  name: "PowerX Nutrition",
  shortName: "PowerX",
  tagline: "Fuel Your Better Tomorrow",
  description:
    "PowerX Nutrition — 100% genuine whey protein, creatine, mass gainers, pre-workouts, vitamins and sports nutrition supplements at the best prices in Tamil Nadu. Cash on Delivery & UPI available.",
  // On Vercel this falls back to the project's production domain when NEXT_PUBLIC_SITE_URL isn't set.
  url: env(
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000",
  ).replace(/\/$/, ""),
  locale: "en_IN",
  keywords: [
    "whey protein",
    "creatine",
    "mass gainer",
    "pre workout",
    "supplements store",
    "sports nutrition",
    "protein shop Tiruvallur",
    "gym supplements Chennai",
    "PowerX Nutrition",
  ],

  contact: {
    phone: env(process.env.NEXT_PUBLIC_CONTACT_PHONE, "9710235320"),
    phone2: env(process.env.NEXT_PUBLIC_CONTACT_PHONE_2, "6382392230"),
    email: env(process.env.NEXT_PUBLIC_CONTACT_EMAIL, "powerxbaasha@gmail.com"),
    address: {
      line1: "No 45, Ground Floor, Shop No-10",
      line2: "Chennai – Thiruvallur High Road, Veppampattu",
      city: "Veppampattu",
      district: "Tiruvallur",
      state: "Tamil Nadu",
      pincode: "602024",
    },
    hours: "Mon – Sun · 9:00 AM – 9:30 PM",
    /**
     * Drives the live "Open now / Closed" badge (always India time). 24-hour "HH:MM".
     * closedDays: 0 = Sunday … 6 = Saturday, e.g. [0] for closed on Sundays. Keep `hours` above in sync.
     */
    openingHours: { open: "09:00", close: "21:30", closedDays: [] as number[] },
    /** Exact shop location from the Google Business listing "PowerX Nutrition". */
    geo: { lat: 13.1269519, lng: 79.9921023 },
    /** Opens the Google Business listing (cid = the listing's permanent id). */
    mapsUrl: "https://maps.google.com/?cid=361610366070180096",
    directionsUrl: "https://www.google.com/maps/dir/?api=1&destination=13.1269519,79.9921023",
    /** Embedded map on the Contact page — shows the listing card with address & rating. */
    mapEmbedUrl: "https://maps.google.com/maps?q=PowerX%20Nutrition&ll=13.1269519,79.9921023&z=17&output=embed",
    /** Shown as "4.9★ on Google". Update occasionally from your Google Business profile. */
    googleRating: { value: 4.9, count: 15 },
  },

  /** WhatsApp number with country code, digits only (e.g. 919710235320). */
  whatsappNumber: env(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER, "919710235320").replace(/\D/g, ""),

  upi: {
    id: env(process.env.NEXT_PUBLIC_UPI_ID, "vinothkumar040996@ibl"),
    name: env(process.env.NEXT_PUBLIC_UPI_NAME, "VINOTHKUMAR SARAVANAN"),
  },

  delivery: {
    charge: num(process.env.NEXT_PUBLIC_DELIVERY_CHARGE, 79),
    freeAbove: num(process.env.NEXT_PUBLIC_FREE_DELIVERY_ABOVE, 999),
    eta: "2–5 business days across India · Same/next day around Tiruvallur",
    /** Cash on Delivery is offered only this far (straight-line km) from the shop's `contact.geo`. */
    codRadiusKm: num(process.env.NEXT_PUBLIC_COD_RADIUS_KM, 5),
  },

  payments: {
    cod: true,
    upi: true,
    whatsapp: true,
  },

  social: {
    instagram: "https://instagram.com/",
    youtube: "https://youtube.com/",
  },
} as const;

export type SiteConfig = typeof siteConfig;
