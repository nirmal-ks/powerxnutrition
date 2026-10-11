// One-off generator: turns the price list (Whey Protein.docx) into data/products.json.
// Re-running it OVERWRITES data/products.json, so after you start editing products
// in the admin panel, don't run this again.
// Usage: node scripts/build-catalog.mjs
import { writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

// [slug, name, brand, category, [[size, price, stock], ...], featured?, note?]
const rows = [
  // ---------------- Whey protein ----------------
  ["maxn-100-whey", "MAXN 100% Whey Protein", "MAXN", "whey-protein", [["1 kg", 3500, 2], ["1.81 kg (4 lb)", 6000, 2]], true],
  ["maxn-casein", "MAXN Casein Protein", "MAXN", "whey-protein", [["2.27 kg (5 lb)", 5200, 2]], false, "Slow-digesting casein protein, ideal before bed to feed muscles through the night."],
  ["gnc-whey-protein", "GNC Pro Performance 100% Whey", "GNC", "whey-protein", [["1.81 kg (4 lb)", 6500, 3]], true],
  ["avatar-whey-protein", "Avvatar Whey Protein", "Avvatar", "whey-protein", [["2 kg", 6900, 1]]],
  ["labrada-100-whey", "Labrada 100% Whey Protein", "Labrada", "whey-protein", [["2 kg", 5500, 2]]],
  ["labrada-turbo-whey", "Labrada Turbo Whey", "Labrada", "whey-protein", [["1.81 kg (4 lb)", 6000, 2]]],
  ["on-gold-standard-whey", "ON Gold Standard 100% Whey", "Optimum Nutrition", "whey-protein", [["1.76 kg (4 lb)", 7800, 1]], true],
  ["on-performance-whey", "ON Performance Whey", "Optimum Nutrition", "whey-protein", [["2 kg", 6000, 2]]],
  ["muscletech-nitrotech-ripped", "MuscleTech NitroTech Ripped", "MuscleTech", "whey-protein", [["1.8 kg", 8000, 1]], false, "Whey protein formulated for lean muscle building while cutting."],
  ["muscletech-nitrotech-whey", "MuscleTech NitroTech Whey Protein", "MuscleTech", "whey-protein", [["1.8 kg", 6900, 1]], true],
  ["muscletech-nitrotech-advance", "MuscleTech NitroTech Advance", "MuscleTech", "whey-protein", [["2 kg", 4500, 2]]],
  ["muscleblaze-whey-protein", "MuscleBlaze Whey Protein", "MuscleBlaze", "whey-protein", [["2 kg", 6800, 2]]],
  ["pure-nation-whey", "Pure Nation Whey Protein", "Pure Nation", "whey-protein", [["2 kg", 3800, 2]]],
  ["musclemeds-carnivor", "MuscleMeds Carnivor Beef Protein", "MuscleMeds", "whey-protein", [["1.81 kg (4 lb)", 6200, 2]], false, "Beef protein isolate — a dairy-free protein option for muscle building."],
  ["apex-whey", "Apex Whey Protein", "Apex", "whey-protein", [["2 kg", 4500, 2]]],
  ["apex-iso", "Apex ISO Whey Isolate", "Apex", "whey-protein", [["2 kg", 6200, 2]]],
  ["carnivor-iso-gold", "Carnivor ISO Gold", "MuscleMeds", "whey-protein", [["2 kg", 4000, 2]]],
  ["c9-100-whey", "C9 100% Whey Protein", "Cloud 9", "whey-protein", [["1 kg", 2500, 4], ["2 kg", 4400, 6]], true],
  ["c9-iso-zero", "C9 ISO Zero Whey Isolate", "Cloud 9", "whey-protein", [["1 kg", 2700, 4], ["2 kg", 4900, 4]]],
  ["kevin-levrone-anabolic-whey", "Kevin Levrone Anabolic Whey", "Kevin Levrone", "whey-protein", [["2 kg", 5000, 2]]],
  ["gibbon-my-whey", "Gibbon My Whey", "Gibbon", "whey-protein", [["1 kg", 2200, 5], ["2 kg", 4000, 5], ["4.5 kg", 8000, 2]], true],
  ["anabolic-research-tri-whey", "Anabolic Research Tri Whey", "Anabolic Research", "whey-protein", [["2 kg", 3500, 2]]],
  ["klr-nitrofit", "KLR Nitrofit Whey", "KLR Nutrition", "whey-protein", [["2 kg", 3500, 2]]],
  ["klr-hydrofit", "KLR Hydrofit Whey", "KLR Nutrition", "whey-protein", [["2 kg", 4200, 2]]],

  // ---------------- Mass gainer ----------------
  ["gnc-mass-gainer", "GNC Pro Performance Weight Gainer", "GNC", "mass-gainer", [["5 kg", 3100, 2]], true],
  ["american-muscle-mass-gainer", "Americanz Muscles Anabolic Mass Gainer", "Americanz Muscles", "mass-gainer", [["5.44 kg (12 lb)", 4300, 1]]],
  ["maxn-mass-gainer", "MAXN Mass Gainer", "MAXN", "mass-gainer", [["1.5 kg", 1000, 4], ["3 kg", 1800, 4], ["5 kg", 2900, 1]], true],
  ["labrada-muscle-mass-gainer", "Labrada Muscle Mass Gainer", "Labrada", "mass-gainer", [["5 kg", 4500, 1]]],
  ["labrada-super-mass", "Labrada Super Mass Gainer", "Labrada", "mass-gainer", [["3 kg", 2800, 4], ["5 kg", 3500, 1]]],
  ["one-science-mass-gainer", "One Science Mass Gainer", "One Science", "mass-gainer", [["5 kg", 4100, 1]]],
  ["c9-mass-gainer", "C9 Mass Gainer", "Cloud 9", "mass-gainer", [["1 kg", 800, 5], ["5 kg", 2400, 4]], true],
  ["kevin-levrone-anabolic-mass", "Kevin Levrone Anabolic Mass", "Kevin Levrone", "mass-gainer", [["3 kg", 3400, 2]]],
  ["gibbon-mass-gainer", "Gibbon Mass Gainer", "Gibbon", "mass-gainer", [["1 kg", 800, 2], ["3 kg", 1800, 2], ["5 kg", 2800, 2]]],

  // ---------------- Pre-workout ----------------
  ["cellucor-c4-original", "Cellucor C4 Original Pre-Workout", "Cellucor", "pre-workout", [["Indian version", 2100, 2], ["50 servings", 3100, 2]], true],
  ["prosupps-hyde-xtreme", "ProSupps Hyde Xtreme Pre-Workout", "ProSupps", "pre-workout", [["1 tub", 1500, 2]]],
  ["muscle-wrath-pre-workout", "MuscleBlaze WrathX Pre-Workout", "MuscleBlaze", "pre-workout", [["1 tub", 1000, 2]]],
  ["kevin-levrone-shaaboom-pump", "Kevin Levrone Shaaboom Pump", "Kevin Levrone", "pre-workout", [["1 tub", 1600, 2]], true],

  // ---------------- Amino acids ----------------
  ["muscletech-eaa", "MuscleTech EAA", "MuscleTech", "amino-acids", [["1 tub", 1300, 2]]],
  ["scivation-xtend-bcaa", "Scivation Xtend BCAA", "Scivation", "amino-acids", [["1 tub", 2000, 2]], true],
  ["maxn-bcaa", "MAXN BCAA", "MAXN", "amino-acids", [["1 tub", 950, 2]]],
  ["labrada-eaa", "Labrada EAA", "Labrada", "amino-acids", [["1 tub", 1400, 2]]],
  ["c9-bcaa", "C9 BCAA", "Cloud 9", "amino-acids", [["1 tub", 1000, 4]]],
  ["gibbon-focus-bcaa", "Gibbon Focus BCAA", "Gibbon", "amino-acids", [["1 tub", 850, 4]]],

  // ---------------- Glutamine ----------------
  ["maxn-glutamine", "MAXN Glutamine", "MAXN", "glutamine", [["1 tub", 900, 2]]],
  ["apex-glutamine", "Apex Glutamine", "Apex", "glutamine", [["1 tub", 900, 2]]],
  ["prosupps-glutamine", "ProSupps Glutamine", "ProSupps", "glutamine", [["1 tub", 900, 2]]],
  ["kevin-levrone-glutamine", "Kevin Levrone Glutamine", "Kevin Levrone", "glutamine", [["1 tub", 850, 2]]],
  ["gibbon-glutamine", "Gibbon Glutamine", "Gibbon", "glutamine", [["1 tub", 700, 5]]],

  // ---------------- Fat burners / L-carnitine ----------------
  ["cloma-black-spider", "Cloma Pharma Black Spider", "Cloma Pharma", "fat-burners", [["1 bottle", 1700, 2]]],
  ["cloma-methyldrene", "Cloma Pharma Methyldrene", "Cloma Pharma", "fat-burners", [["1 bottle", 1750, 2]]],
  ["nutrex-lipo-6", "Nutrex Lipo 6", "Nutrex", "fat-burners", [["1 bottle", 1400, 1]]],
  ["muscletech-hydroxycut", "MuscleTech Hydroxycut", "MuscleTech", "fat-burners", [["1 bottle", 1350, 1]]],
  ["l-carnitine-indian", "L-Carnitine (Indian Version)", "Assorted", "fat-burners", [["1 bottle", 1400, 2]]],
  ["labrada-l-carnitine", "Labrada L-Carnitine", "Labrada", "fat-burners", [["1 bottle", 1100, 2]]],

  // ---------------- Omega-3 / fish oil ----------------
  ["maxn-omega-3", "MAXN Omega-3 Fish Oil", "MAXN", "omega-3", [["1 bottle", 350, 2]]],
  ["carbamide-forte-fish-oil", "Carbamide Forte Fish Oil", "Carbamide Forte", "omega-3", [["90 tablets", 700, 2]]],
  ["youwefit-fish-oil", "YouWeFit Fish Oil", "YouWeFit", "omega-3", [["1 bottle", 400, 2]]],
  ["muscleblaze-fish-oil", "MuscleBlaze Fish Oil", "MuscleBlaze", "omega-3", [["1 bottle", 500, 2]]],
  ["c9-fish-oil", "C9 Fish Oil", "Cloud 9", "omega-3", [["60 softgels", 500, 2]]],

  // ---------------- Vitamins / ZMA ----------------
  ["labrada-multivitamin", "Labrada Multivitamin", "Labrada", "vitamins", [["1 bottle", 600, 1]]],
  ["gnc-multivitamin", "GNC Multivitamin", "GNC", "vitamins", [["1 bottle", 600, 1]]],
  ["carbamide-forte-multivitamin", "Carbamide Forte Multivitamin", "Carbamide Forte", "vitamins", [["1 bottle", 500, 1]]],
  ["on-opti-men", "ON Opti-Men Multivitamin", "Optimum Nutrition", "vitamins", [["1 bottle", 500, 1]], true],
  ["c9-multivitamin", "C9 Multivitamin", "Cloud 9", "vitamins", [["1 bottle", 450, 6]]],
  ["maxn-zma", "MAXN ZMA", "MAXN", "vitamins", [["1 bottle", 750, 1]], false, "Zinc, magnesium and vitamin B6 — take at night before sleep to support recovery."],
  ["carbamide-forte-zma", "Carbamide Forte ZMA", "Carbamide Forte", "vitamins", [["1 bottle", 500, 1]], false, "Zinc, magnesium and vitamin B6 — take at night before sleep to support recovery."],
  ["c9-zma", "C9 ZMA", "Cloud 9", "vitamins", [["1 bottle", 450, 4]], false, "Zinc, magnesium and vitamin B6 — take at night before sleep to support recovery."],

  // ---------------- Creatine ----------------
  ["wellcore-creatine", "Wellcore Micronised Creatine", "Wellcore", "creatine", [["100 g", 450, 4], ["250 g", 770, 4]], true],
  ["muscleblaze-creatine", "MuscleBlaze Creatine Monohydrate", "MuscleBlaze", "creatine", [["Unflavoured", 750, 4]], true],
  ["c9-creatine", "C9 Creatine Monohydrate", "Cloud 9", "creatine", [["1 tub", 450, 6]]],
  ["kevin-levrone-creatine", "Kevin Levrone Creatine", "Kevin Levrone", "creatine", [["1 tub", 750, 2]]],
  ["gibbon-creatine", "Gibbon Creatine", "Gibbon", "creatine", [["1 tub", 550, 5]]],

  // ---------------- Healthy food ----------------
  ["alpino-high-protein-muesli", "Alpino High Protein Muesli", "Alpino", "healthy-food", [["400 g", 250, 12]]],
  ["super-protein-bar", "Super Protein Bar", "Super Bar", "healthy-food", [["1 bar", 59, 120]]],
  ["alpino-super-oats", "Alpino Super Oats", "Alpino", "healthy-food", [["1 kg", 420, 12], ["2.5 kg", 950, 8]]],
  ["alpino-peanut-butter", "Alpino High Protein Peanut Butter", "Alpino", "healthy-food", [["1 jar", 500, 12]]],
];

const blurbs = {
  "whey-protein": (n, b) => `${n} by ${b} is a high-quality protein powder that helps you build lean muscle and recover faster after training. Mixes easily with water or milk — perfect as a post-workout shake or to top up your daily protein intake.`,
  "mass-gainer": (n, b) => `${n} by ${b} packs extra calories, carbohydrates and protein to help hard-gainers put on healthy weight and size. Take it between meals or after training to support your bulking goals.`,
  "pre-workout": (n, b) => `${n} by ${b} is a pre-workout formula for energy, focus and pump. Take it 20–30 minutes before training to push harder, lift heavier and go longer.`,
  "amino-acids": (n, b) => `${n} by ${b} delivers essential amino acids that support muscle recovery and reduce soreness. Sip before, during or after your workout.`,
  glutamine: (n, b) => `${n} by ${b} supports faster muscle recovery and immune health, especially during intense training phases.`,
  "fat-burners": (n, b) => `${n} by ${b} supports fat metabolism and energy as part of a disciplined diet and training plan. Follow the label directions and do not exceed the recommended dose.`,
  "omega-3": (n, b) => `${n} by ${b} provides omega-3 fatty acids (EPA & DHA) that support heart, brain and joint health — a daily essential for active people.`,
  vitamins: (n, b) => `${n} by ${b} fills nutritional gaps with essential vitamins and minerals to support daily energy, immunity and overall wellness.`,
  creatine: (n, b) => `${n} by ${b} is one of the most researched supplements for strength and power. A daily 3–5 g dose helps increase strength, power output and muscle volume.`,
  "healthy-food": (n, b) => `${n} by ${b} — a tasty, protein-rich everyday food that makes clean eating easy for fitness lovers.`,
};

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// Placeholder MRP (â‰ˆ20% above selling price). VERIFY against the MRP printed on each pack.
const mrpFor = (price) => (price < 200 ? Math.ceil(price * 1.2) : Math.ceil((price * 1.2) / 50) * 50 - 1);

const imgDir = join(root, "public", "products");
const images = existsSync(imgDir) ? readdirSync(imgDir) : [];
const findImage = (slug) => {
  const f = images.find((x) => x.replace(/\.(jpe?g|png|webp|avif)$/i, "") === slug);
  return f ? `/products/${f}` : "";
};

const products = rows.map(([slug, name, brand, category, variants, featured = false, note], i) => ({
  slug,
  name,
  brand,
  category,
  description: note ? `${note} ${blurbs[category](name, brand)}` : blurbs[category](name, brand),
  image: findImage(slug),
  variants: variants.map(([label, price, stock]) => ({ id: slugify(label), label, price, mrp: mrpFor(price), stock })),
  featured,
  active: true,
  sort: i,
}));

mkdirSync(join(root, "data"), { recursive: true });
writeFileSync(join(root, "data", "products.json"), JSON.stringify(products, null, 2) + "\n");
console.log(`Wrote ${products.length} products (${products.filter((p) => p.image).length} with images).`);
