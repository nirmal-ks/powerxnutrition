import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/adapter";
import { scoreMatch, isConfidentMatch, sameSize } from "@/lib/matching";
import { addUrlCandidate, approveCandidate, findCandidates, listCandidates, rateCandidate } from "@/lib/server/images";
import { listProducts } from "@/lib/server/products";
import { CASHIER, MANAGER, STOCK, testDb } from "./helpers/db";

let db: Db;
let creatineId: string;
let wheyId: string;

const off = (products: unknown[]) => (async (url: string) => new Response(JSON.stringify(url.includes("/api/v2/product/") ? { status: 0 } : { products }), { status: 200 })) as unknown as typeof fetch;

beforeAll(async () => {
  db = await testDb();
  creatineId = (await db.query<{ id: string }>("select id from products where slug = 'mb-creatine'"))[0].id;
  wheyId = (await db.query<{ id: string }>("select id from products where slug = 'on-gold-whey'"))[0].id;
});
afterAll(() => db.close());

describe("image / product matching", () => {
  const target = { brand: "Optimum Nutrition", name: "Gold Standard 100% Whey", size: "2 lb", flavour: "Double Rich Chocolate" };
  it("exact product match is confident", () => {
    const r = scoreMatch(target, { brand: "", name: "Optimum Nutrition Gold Standard 100% Whey Double Rich Chocolate 2 lbs", size: "Optimum Nutrition Gold Standard 100% Whey Double Rich Chocolate 2 lbs", flavour: "Double Rich Chocolate 2 lbs" });
    expect(r.sizeOk).toBe(true);
    expect(r.flavourOk).toBe(true);
    expect(isConfidentMatch(r)).toBe(true);
  });
  it("incorrect flavour is flagged and never confident", () => {
    const r = scoreMatch(target, { brand: "", name: "Optimum Nutrition Gold Standard Whey Vanilla Ice Cream 2 lb", size: "2 lb", flavour: "Vanilla Ice Cream" });
    expect(r.flavourOk).toBe(false);
    expect(r.reasons).toContain("flavour is different");
    expect(isConfidentMatch(r)).toBe(false);
  });
  it("incorrect size is flagged and never confident", () => {
    const r = scoreMatch(target, { brand: "", name: "Optimum Nutrition Gold Standard Whey Double Rich Chocolate 5 lb", size: "5 lb", flavour: "Double Rich Chocolate" });
    expect(r.sizeOk).toBe(false);
    expect(r.reasons).toContain("size is different");
    expect(isConfidentMatch(r)).toBe(false);
    expect(sameSize("4 lb", "1.81 kg")).toBe(true);
    expect(sameSize("1 kg", "2 lb")).toBe(false);
  });
});

describe("image search & approval", () => {
  it("no image found → product stays IMAGE_PENDING with a placeholder", async () => {
    const r = await db.tx((q) => findCandidates(q, STOCK, creatineId, {}, off([])));
    expect(r.added).toBe(0);
    const p = await db.query<{ image_status: string }>("select image_status from products where id = $1", [creatineId]);
    expect(p[0].image_status).toBe("IMAGE_PENDING");
  });

  it("image provider unavailable → reported, nothing breaks", async () => {
    const down = (async () => { throw new Error("ECONNRESET"); }) as unknown as typeof fetch;
    const r = await db.tx((q) => findCandidates(q, STOCK, creatineId, {}, down));
    expect(r.errors?.[0]).toMatch(/Open Food Facts unavailable/);
    expect(r.added).toBe(0);
  });

  it("candidates are suggestions only: REVIEW_REQUIRED, not shown on the website", async () => {
    const r = await db.tx((q) =>
      findCandidates(q, STOCK, creatineId, {}, off([{ code: "890", product_name: "Creatine Monohydrate 250 g", brands: "MuscleBlaze", quantity: "250 g", image_front_url: "https://images.openfoodfacts.org/x.jpg" }])),
    );
    expect(r.added).toBe(1);
    const st = await db.query<{ image_status: string; image: string }>("select image_status, image from products where id = $1", [creatineId]);
    expect(st[0].image_status).toBe("REVIEW_REQUIRED");
    const shop = (await listProducts(db, { publishedOnly: true })).find((p) => p.slug === "mb-creatine")!;
    expect(shop.image).toBe(""); // unapproved → placeholder on the storefront
  });

  it("unauthorised staff can't approve; approval publishes the stored image", async () => {
    const [c] = await listCandidates(db, creatineId);
    await expect(db.tx((q) => approveCandidate(q, CASHIER, c.id, "/uploads/x.webp"))).rejects.toThrow(/owner or a manager/);
    await expect(db.tx((q) => approveCandidate(q, STOCK, c.id, "/uploads/x.webp"))).rejects.toThrow(/owner or a manager/);
    await db.tx((q) => approveCandidate(q, MANAGER, c.id, "/uploads/mb-creatine-abc.webp"));
    const shop = (await listProducts(db, { publishedOnly: true })).find((p) => p.slug === "mb-creatine")!;
    expect(shop.image).toBe("/uploads/mb-creatine-abc.webp");
    const log = await db.query("select 1 from audit_logs where action = 'image.approved' and entity_id = $1", [creatineId]);
    expect(log.length).toBe(1);
  });

  it("existing approved images are preserved — search skips them unless explicitly asked", async () => {
    const before = await db.query<{ image: string }>("select image from products where id = $1", [wheyId]);
    const r = await db.tx((q) => findCandidates(q, STOCK, wheyId, {}, off([{ code: "1", product_name: "Gold Standard", brands: "ON", image_front_url: "https://images.openfoodfacts.org/y.jpg" }])));
    expect(r.skipped).toBe(true);
    await db.tx((q) => addUrlCandidate(q, MANAGER, wheyId, "https://brand.example/whey.jpg", "", "ON Gold Standard 1 kg"));
    const after = await db.query<{ image: string; image_status: string }>("select image, image_status from products where id = $1", [wheyId]);
    expect(after[0]).toEqual({ image: before[0].image, image_status: "APPROVED" });
  });

  it("barcode hits rank high; mismatched candidates rank low", () => {
    const p = { id: "x", name: "Gold Standard 100% Whey", brand: "Optimum Nutrition", label: "1 kg", flavour: "Chocolate", barcode: "748927052138", sku: "" };
    expect(rateCandidate(p, { source: "openfoodfacts", sourceUrl: "", imageUrl: "", title: "something", attribution: "", license: "", barcodeMatch: true }).score).toBeGreaterThanOrEqual(90);
    expect(rateCandidate(p, { source: "google", sourceUrl: "", imageUrl: "", title: "Optimum Nutrition Gold Standard Whey Vanilla 5 lb", attribution: "", license: "" }).score).toBeLessThan(50);
  });
});
