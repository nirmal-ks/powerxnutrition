/**
 * Product identity matching shared by stock imports, supplier-invoice extraction and image search.
 * Principle: similar names are NOT the same SKU. Size and flavour must agree; when they don't (or
 * can't be confirmed) the result is a suggestion for a human, never an automatic match.
 */

const STOP = new Set(["the", "and", "with", "for", "of", "nutrition", "sports", "supplement", "powder", "pack", "new", "x", "by"]);

export const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}.%]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

export const tokens = (s: string) => norm(s).split(" ").filter((t) => t && !STOP.has(t));

/** Parses a pack size into grams / ml / count so "1kg", "1000 g", "2.2 lb" compare correctly. */
export function parseSize(s: string): { value: number; unit: "g" | "ml" | "count" } | null {
  const t = norm(s).replace(/(\d),(\d)/g, "$1.$2");
  const m = t.match(/(\d+(?:\.\d+)?)\s*(kg|kgs|g|gm|gms|gram|grams|lb|lbs|pound|pounds|oz|ml|l|ltr|litre|liter|caps|capsules|tabs|tablets|softgels|servings|pcs|pieces|bars|sachets)\b/);
  if (!m) return null;
  const n = Number(m[1]);
  switch (m[2]) {
    case "kg":
    case "kgs":
      return { value: Math.round(n * 1000), unit: "g" };
    case "g":
    case "gm":
    case "gms":
    case "gram":
    case "grams":
      return { value: Math.round(n), unit: "g" };
    case "lb":
    case "lbs":
    case "pound":
    case "pounds":
      return { value: Math.round(n * 453.592), unit: "g" };
    case "oz":
      return { value: Math.round(n * 28.3495), unit: "g" };
    case "ml":
      return { value: Math.round(n), unit: "ml" };
    case "l":
    case "ltr":
    case "litre":
    case "liter":
      return { value: Math.round(n * 1000), unit: "ml" };
    default:
      return { value: Math.round(n), unit: "count" };
  }
}

/** Same size if within 3% (e.g. 4 lb = 1814 g vs label "1.81 kg"). */
export function sameSize(a: string, b: string): boolean | null {
  const A = parseSize(a);
  const B = parseSize(b);
  if (!A || !B) return null;
  if (A.unit !== B.unit) return false;
  return Math.abs(A.value - B.value) / Math.max(A.value, B.value) <= 0.03;
}

const FLAVOUR_WORDS = [
  "chocolate", "choco", "vanilla", "strawberry", "mango", "banana", "coffee", "mocha", "cookies", "cream", "caramel", "unflavoured",
  "unflavored", "unflavor", "natural", "fruit", "punch", "watermelon", "orange", "lemon", "lime", "blueberry", "raspberry", "kulfi",
  "malai", "rich", "double", "rocky", "road", "butterscotch", "pineapple", "cola", "green", "apple", "peach", "mint", "hazelnut",
  "cinnamon", "kesar", "pista", "badam", "cafe", "latte", "biscuit", "cake", "birthday", "tropical", "berry", "grape", "litchi",
];

export function flavourTokens(s: string) {
  return [...new Set(tokens(s).filter((t) => FLAVOUR_WORDS.includes(t) || FLAVOUR_WORDS.some((f) => t.startsWith(f.slice(0, 5)) && t.length >= 5)))];
}

export function sameFlavour(a: string, b: string): boolean | null {
  const A = flavourTokens(a);
  const B = flavourTokens(b);
  if (!A.length && !B.length) return null;
  if (!A.length || !B.length) return null; // one side unknown → can't confirm
  const setB = new Set(B.map((t) => t.slice(0, 5)));
  const overlap = A.filter((t) => setB.has(t.slice(0, 5))).length;
  return overlap / Math.max(A.length, B.length) >= 0.6;
}

/** Mostly "how much of the wanted name is present", with a small penalty for lots of extra words. */
function overlap(a: string[], b: string[]) {
  if (!a.length || !b.length) return 0;
  const B = new Set(b);
  const hits = a.filter((t) => B.has(t)).length;
  return 0.8 * (hits / a.length) + 0.2 * (hits / Math.max(a.length, b.length));
}

export interface MatchTarget {
  brand: string;
  name: string;
  size?: string;
  flavour?: string;
}

export interface MatchResult {
  score: number; // 0–100
  sizeOk: boolean | null;
  flavourOk: boolean | null;
  brandOk: boolean;
  reasons: string[];
}

/** Scores how well a described item (from a file/invoice/image title) matches a catalogue variant. */
export function scoreMatch(item: MatchTarget, candidate: MatchTarget): MatchResult {
  const reasons: string[] = [];
  const brandOk = !item.brand || !candidate.brand || norm(candidate.brand).includes(norm(item.brand)) || norm(item.brand).includes(norm(candidate.brand)) || tokens(`${item.name}`).some((t) => tokens(candidate.brand).includes(t));
  const nameScore = overlap(tokens(`${item.brand} ${item.name}`), tokens(`${candidate.brand} ${candidate.name}`));
  const sizeOk = item.size && candidate.size ? sameSize(item.size, candidate.size) : item.size ? sameSize(`${item.name} ${item.size}`, `${candidate.name} ${candidate.size ?? ""}`) : null;
  const flavourOk =
    item.flavour !== undefined && candidate.flavour !== undefined
      ? sameFlavour(`${item.flavour} ${item.name}`, `${candidate.flavour} ${candidate.name}`)
      : sameFlavour(`${item.flavour ?? ""} ${item.name}`, `${candidate.flavour ?? ""} ${candidate.name}`);
  let score = nameScore * 70 + (brandOk ? 15 : 0);
  if (sizeOk === true) score += 15;
  if (sizeOk === false) {
    score -= 45;
    reasons.push("size is different");
  }
  if (sizeOk === null) reasons.push("size not confirmed");
  if (flavourOk === false) {
    score -= 40;
    reasons.push("flavour is different");
  }
  if (flavourOk === null && (item.flavour || candidate.flavour)) reasons.push("flavour not confirmed");
  if (!brandOk) reasons.push("brand is different");
  return { score: Math.max(0, Math.min(100, Math.round(score))), sizeOk, flavourOk, brandOk, reasons };
}

/** Auto-accept only when brand, name, size AND flavour all agree. Everything else needs a person. */
export const isConfidentMatch = (r: MatchResult) => r.score >= 85 && r.brandOk && r.sizeOk === true && r.flavourOk !== false;
