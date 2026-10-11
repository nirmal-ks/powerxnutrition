import type { CategorySlug, Product } from "@/types";

export interface CategoryInfo {
  slug: CategorySlug;
  name: string;
  tamil: string;
  tagline: string;
  benefits: string[];
  when: string;
  how: string;
  /** Tailwind gradient used for category tiles & placeholders */
  accent: string;
}

/** Category details — "what it does, when to take, how it helps" from the PowerX supplement guide. */
export const categories: CategoryInfo[] = [
  {
    slug: "whey-protein",
    name: "Whey Protein",
    tamil: "வேய் புரோட்டீன்",
    tagline: "Build & recover",
    benefits: ["High-quality protein", "Supports muscle recovery", "Helps muscle growth"],
    when: "After workout (within 30 min) or any time of day",
    how: "1 scoop (25–30 g) with water or milk",
    accent: "from-red-600 to-red-900",
  },
  {
    slug: "creatine",
    name: "Creatine",
    tamil: "கிரியேட்டின்",
    tagline: "Strength & power",
    benefits: ["Increases strength & power", "Supports high-intensity training", "Adds muscle volume"],
    when: "Once a day, any time",
    how: "3–5 g (1 scoop) with water",
    accent: "from-sky-600 to-slate-900",
  },
  {
    slug: "mass-gainer",
    name: "Mass Gainer",
    tamil: "மாஸ் கேய்னர்",
    tagline: "Size & weight",
    benefits: ["Extra calories + protein", "Supports weight gain", "Great for lean body types"],
    when: "Morning, after workout or between meals",
    how: "1–2 scoops with water or milk",
    accent: "from-amber-500 to-orange-900",
  },
  {
    slug: "pre-workout",
    name: "Pre-Workout",
    tamil: "ப்ரீ வொர்க்அவுட்",
    tagline: "Energy & focus",
    benefits: ["Energy, focus & alertness", "Train longer and harder", "Boosts performance"],
    when: "20–30 minutes before workout",
    how: "1 scoop with water",
    accent: "from-yellow-400 to-red-700",
  },
  {
    slug: "amino-acids",
    name: "BCAA & EAA",
    tamil: "அமினோ அமிலங்கள்",
    tagline: "Recover faster",
    benefits: ["Reduces muscle fatigue", "Protects muscle during workouts", "Supports protein synthesis"],
    when: "Before, during or after workout",
    how: "1 scoop (5–10 g) with water",
    accent: "from-fuchsia-600 to-purple-900",
  },
  {
    slug: "glutamine",
    name: "Glutamine",
    tamil: "குளுட்டமின்",
    tagline: "Recovery & immunity",
    benefits: ["Faster muscle recovery", "Supports immune health", "Reduces tiredness"],
    when: "After workout or at night",
    how: "1 scoop (5 g) with water",
    accent: "from-rose-500 to-rose-900",
  },
  {
    slug: "fat-burners",
    name: "Fat Burners & L-Carnitine",
    tamil: "கொழுப்பு எரிப்பு",
    tagline: "Cut & define",
    benefits: ["Supports fat metabolism", "Helps weight management", "Improves energy"],
    when: "Before workout (morning)",
    how: "As directed on the label (L-Carnitine: 1–2 g)",
    accent: "from-orange-500 to-red-900",
  },
  {
    slug: "omega-3",
    name: "Omega-3 Fish Oil",
    tamil: "ஒமேகா-3",
    tagline: "Heart & joints",
    benefits: ["Supports heart health", "Improves brain function", "Good for joints"],
    when: "After meals (morning / night)",
    how: "1–2 softgels with food",
    accent: "from-yellow-500 to-amber-800",
  },
  {
    slug: "vitamins",
    name: "Vitamins & ZMA",
    tamil: "மல்டிவிட்டமின்",
    tagline: "Daily wellness",
    benefits: ["Essential vitamins & minerals", "Supports immunity", "Daily energy"],
    when: "After breakfast (ZMA: before sleep)",
    how: "1 tablet / capsule with food",
    accent: "from-emerald-500 to-emerald-900",
  },
  {
    slug: "healthy-food",
    name: "Oats, Muesli & Bars",
    tamil: "ஆரோக்கிய உணவு",
    tagline: "Eat clean",
    benefits: ["Protein-rich everyday food", "Healthy snacking", "Easy clean eating"],
    when: "Breakfast or as a snack",
    how: "As part of your daily diet",
    accent: "from-amber-700 to-stone-900",
  },
];

export const categoryBySlug = (slug: string) => categories.find((c) => c.slug === slug);

export const productUrl = (slug: string) => `/product/${slug}`;
export const categoryUrl = (slug: string) => `/shop/${slug}`;

export const minPrice = (p: Product) => Math.min(...p.variants.map((v) => v.price));
export const totalStock = (p: Product) => p.variants.reduce((s, v) => s + Math.max(0, v.stock), 0);
export const inStock = (p: Product) => totalStock(p) > 0;

/** The variant to show first: cheapest one that's in stock, else the first. */
export const defaultVariant = (p: Product) =>
  [...p.variants].filter((v) => v.stock > 0).sort((a, b) => a.price - b.price)[0] ?? p.variants[0];

export const brandsOf = (products: Product[]) => [...new Set(products.map((p) => p.brand))].sort();
