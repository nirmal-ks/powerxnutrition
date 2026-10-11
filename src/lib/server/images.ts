import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { Queryable } from "@/lib/db/adapter";
import { newId } from "@/lib/db/ids";
import { scoreMatch } from "@/lib/matching";
import { can, type Actor } from "@/lib/permissions";
import { audit } from "./audit";
import { AppError, bad, conflict, forbidden, notFound } from "./errors";

/**
 * Product image discovery + human approval.
 *  Sources (all free): Open Food Facts (open database, CC BY-SA images, barcode/name lookup),
 *  Google Programmable Search (optional, 100 free queries/day, restricted to sites the owner
 *  chooses — e.g. brand & supplier catalogues), an image URL pasted from a supplier/brand page,
 *  or a photo uploaded by staff.
 *  Rules: an existing APPROVED image is never replaced automatically; candidates are only ever
 *  "suggestions" until a reviewer approves one; size/flavour mismatches are flagged loudly.
 */

export interface Candidate {
  source: "openfoodfacts" | "google" | "url" | "upload";
  sourceUrl: string;
  imageUrl: string;
  title: string;
  attribution: string;
  license: string;
  barcodeMatch?: boolean;
}

export interface ProductIdentity {
  id: string;
  name: string;
  brand: string;
  label: string; // size of the first/selected variant
  flavour: string;
  barcode: string;
  sku: string;
}

const UA = "PowerXNutritionAdmin/1.0 (shop inventory; contact via website)";

async function getJson(url: string, fetchImpl: typeof fetch, timeoutMs = 8000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: ctl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

type OffProduct = { code?: string; product_name?: string; brands?: string; quantity?: string; image_front_url?: string; image_url?: string };

export async function searchOpenFoodFacts(p: ProductIdentity, fetchImpl: typeof fetch = fetch): Promise<Candidate[]> {
  const out: Candidate[] = [];
  const toCand = (x: OffProduct, barcodeMatch: boolean): Candidate | null => {
    const img = x.image_front_url || x.image_url;
    if (!img) return null;
    return {
      source: "openfoodfacts",
      sourceUrl: `https://world.openfoodfacts.org/product/${x.code}`,
      imageUrl: img,
      title: [x.brands, x.product_name, x.quantity].filter(Boolean).join(" · "),
      attribution: "Photo from Open Food Facts contributors",
      license: "CC BY-SA 3.0 (attribution required)",
      barcodeMatch,
    };
  };
  if (p.barcode && /^\d{8,14}$/.test(p.barcode)) {
    const d = (await getJson(`https://world.openfoodfacts.org/api/v2/product/${p.barcode}.json?fields=code,product_name,brands,quantity,image_front_url,image_url`, fetchImpl)) as { status?: number; product?: OffProduct };
    if (d.status === 1 && d.product) {
      const c = toCand({ ...d.product, code: p.barcode }, true);
      if (c) out.push(c);
    }
  }
  if (!out.length) {
    const terms = encodeURIComponent(`${p.brand} ${p.name}`.slice(0, 100));
    const d = (await getJson(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${terms}&search_simple=1&json=1&page_size=8&fields=code,product_name,brands,quantity,image_front_url,image_url`, fetchImpl)) as { products?: OffProduct[] };
    for (const x of d.products ?? []) {
      const c = toCand(x, false);
      if (c) out.push(c);
    }
  }
  return out;
}

export const googleConfigured = () => Boolean(process.env.GOOGLE_CSE_KEY && process.env.GOOGLE_CSE_CX);

export async function searchGoogle(p: ProductIdentity, fetchImpl: typeof fetch = fetch): Promise<Candidate[]> {
  if (!googleConfigured()) return [];
  const qs = new URLSearchParams({
    key: process.env.GOOGLE_CSE_KEY!,
    cx: process.env.GOOGLE_CSE_CX!,
    q: [p.brand, p.name, p.label, p.flavour].filter(Boolean).join(" "),
    searchType: "image",
    num: "8",
    safe: "active",
  });
  const d = (await getJson(`https://www.googleapis.com/customsearch/v1?${qs}`, fetchImpl)) as { items?: { link: string; title: string; displayLink?: string; image?: { contextLink?: string } }[] };
  return (d.items ?? []).map((i) => ({
    source: "google" as const,
    sourceUrl: i.image?.contextLink ?? i.link,
    imageUrl: i.link,
    title: i.title,
    attribution: `Found on ${i.displayLink ?? "the web"}`,
    license: "Check the website's terms — use only official brand/supplier images you're allowed to use",
  }));
}

/** Scores a candidate against the exact product: brand, name, SIZE and FLAVOUR. */
export function rateCandidate(p: ProductIdentity, c: Candidate) {
  const r = scoreMatch({ brand: p.brand, name: p.name, size: p.label, flavour: p.flavour }, { brand: "", name: c.title, size: c.title, flavour: c.title });
  const notes = [...r.reasons];
  let score = r.score;
  if (c.barcodeMatch) {
    score = Math.max(score, 90);
    notes.unshift("barcode matches");
  }
  if (c.source === "url" || c.source === "upload") notes.push("added by staff");
  return { score, notes };
}

/** Finds candidates for a product and stores them for review. Never touches an approved image. */
export async function findCandidates(q: Queryable, actor: Actor, productId: string, opts: { force?: boolean } = {}, fetchImpl: typeof fetch = fetch) {
  const p = await identity(q, productId);
  const prod = (await q.query<{ image_status: string }>("select image_status from products where id = $1", [productId]))[0];
  if (prod.image_status === "APPROVED" && !opts.force) {
    return { skipped: true, reason: "This product already has an approved photo — it is kept as is.", candidates: [] as unknown[], errors: [] as string[] };
  }
  const errors: string[] = [];
  const found: Candidate[] = [];
  for (const [name, fn] of [["Open Food Facts", searchOpenFoodFacts], ["Google", searchGoogle]] as const) {
    try {
      found.push(...(await fn(p, fetchImpl)));
    } catch (e) {
      errors.push(`${name} unavailable (${(e as Error).message})`);
    }
  }
  const existing = new Set((await q.query<{ image_url: string }>("select image_url from image_candidates where product_id = $1", [productId])).map((r) => r.image_url));
  let added = 0;
  for (const c of found) {
    if (existing.has(c.imageUrl) || !/^https:\/\//.test(c.imageUrl)) continue;
    const { score, notes } = rateCandidate(p, c);
    await q.query(
      `insert into image_candidates (id, product_id, source, source_url, image_url, title, attribution, license, score, match_notes, created_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [newId(), productId, c.source, c.sourceUrl, c.imageUrl, c.title.slice(0, 300), c.attribution, c.license, score, JSON.stringify(notes), actor.id],
    );
    added++;
  }
  if (prod.image_status !== "APPROVED") {
    const any = await q.query("select 1 from image_candidates where product_id = $1 and status = 'candidate' limit 1", [productId]);
    await q.query("update products set image_status = $2, updated_at = now() where id = $1", [productId, any.length ? "REVIEW_REQUIRED" : "IMAGE_PENDING"]);
  }
  await audit(q, actor, "image.searched", { type: "product", id: productId }, `Image search for ${p.brand} ${p.name}: ${added} new candidate(s)${errors.length ? ` · ${errors.join("; ")}` : ""}`);
  return { skipped: false, added, errors, candidates: await listCandidates(q, productId) };
}

async function identity(q: Queryable, productId: string): Promise<ProductIdentity> {
  const r = await q.query<ProductIdentity>(
    `select p.id, p.name, p.brand, coalesce(v.label,'') as label, coalesce(v.flavour,'') as flavour, coalesce(v.barcode,'') as barcode, coalesce(v.sku,'') as sku
     from products p left join lateral (select * from product_variants v where v.product_id = p.id and v.active order by (v.barcode is not null) desc, v.sort limit 1) v on true
     where p.id = $1`,
    [productId],
  );
  if (!r[0]) throw notFound("Product not found");
  return r[0];
}

export async function listCandidates(q: Queryable, productId: string) {
  return q.query<{ id: string; source: string; source_url: string; image_url: string; title: string; attribution: string; license: string; score: number; match_notes: string[]; ai_check: unknown; status: string; created_at: string }>(
    "select id, source, source_url, image_url, title, attribution, license, score, match_notes, ai_check, status, created_at from image_candidates where product_id = $1 and status <> 'rejected' order by status = 'approved' desc, score desc, created_at desc",
    [productId],
  );
}

/** Products that need a photo decision (pending / review required), for the review queue. */
export async function imageQueue(q: Queryable, status?: string) {
  return q.query<{ id: string; slug: string; name: string; brand: string; category: string; image: string; image_status: string; status: string; candidates: number; best_score: number | null; label: string; flavour: string }>(
    `select p.id, p.slug, p.name, p.brand, p.category, p.image, p.image_status, p.status,
            (select count(*) from image_candidates c where c.product_id = p.id and c.status = 'candidate')::int as candidates,
            (select max(score) from image_candidates c where c.product_id = p.id and c.status = 'candidate') as best_score,
            coalesce((select string_agg(distinct v.label, ', ') from product_variants v where v.product_id = p.id and v.active), '') as label,
            coalesce((select string_agg(distinct nullif(v.flavour,''), ', ') from product_variants v where v.product_id = p.id and v.active), '') as flavour
     from products p where p.status <> 'archived' and ${status === "APPROVED" ? "p.image_status = 'APPROVED'" : status ? "p.image_status = $1" : "p.image_status <> 'APPROVED'"}
     order by p.image_status = 'REVIEW_REQUIRED' desc, p.status = 'published' desc, p.name`,
    status && status !== "APPROVED" ? [status] : [],
  );
}

// ---------------------------------------------------------------- safe remote fetch

function privateIp(ip: string): boolean {
  if (ip.includes(":")) return ip === "::1" || /^f[cd]/i.test(ip) || /^fe80/i.test(ip) || ip.startsWith("::ffff:") && privateIp(ip.slice(7));
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

/** Downloads an image from a public https URL (blocks internal addresses, non-images, >8 MB). */
async function assertPublicHttps(raw: string) {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw bad("That isn't a valid image link");
  }
  if (u.protocol !== "https:") throw bad("Only https:// image links are allowed");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (!addrs.length || addrs.some((a) => privateIp(a.address))) throw bad("That link can't be used");
  return u;
}

export async function fetchRemoteImage(url: string, fetchImpl: typeof fetch = fetch): Promise<Buffer> {
  let u = await assertPublicHttps(url);
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 15000);
  try {
    let res: Response | null = null;
    for (let hop = 0; hop < 4; hop++) {
      res = await fetchImpl(u.toString(), { headers: { "User-Agent": UA, Accept: "image/*" }, redirect: "manual", signal: ctl.signal });
      const loc = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
      if (!loc) break;
      u = await assertPublicHttps(new URL(loc, u).toString()); // every redirect target is re-checked
      res = null;
    }
    if (!res) throw bad("Too many redirects");
    if (!res.ok) throw new AppError(`Couldn't download the image (HTTP ${res.status})`, 502);
    const type = res.headers.get("content-type") ?? "";
    if (!/^image\/(jpeg|png|webp|avif)/.test(type)) throw bad("The link didn't return a JPG/PNG/WEBP image");
    const len = Number(res.headers.get("content-length") ?? 0);
    if (len > 8 * 1024 * 1024) throw bad("Image is larger than 8 MB");
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 8 * 1024 * 1024) throw bad("Image is larger than 8 MB");
    return buf;
  } finally {
    clearTimeout(t);
  }
}

/** Staff adds a candidate from a pasted link (e.g. the brand's or supplier's product page image). */
export async function addUrlCandidate(q: Queryable, actor: Actor, productId: string, imageUrl: string, sourceUrl: string, note: string) {
  if (!/^https:\/\//.test(imageUrl)) throw bad("Paste an https:// image link");
  const p = await identity(q, productId);
  const c: Candidate = { source: "url", sourceUrl: sourceUrl || imageUrl, imageUrl, title: note || `${p.brand} ${p.name}`, attribution: `Added by ${actor.name}`, license: "Staff confirmed permission to use" };
  const { score, notes } = rateCandidate(p, c);
  const id = newId();
  await q.query(
    `insert into image_candidates (id, product_id, source, source_url, image_url, title, attribution, license, score, match_notes, created_by) values ($1,$2,'url',$3,$4,$5,$6,$7,$8,$9,$10)`,
    [id, productId, c.sourceUrl, imageUrl, c.title.slice(0, 300), c.attribution, c.license, score, JSON.stringify(notes), actor.id],
  );
  await q.query("update products set image_status = 'REVIEW_REQUIRED', updated_at = now() where id = $1 and image_status <> 'APPROVED'", [productId]);
  await audit(q, actor, "image.candidate_added", { type: "product", id: productId }, `Added image link for ${p.brand} ${p.name}`);
  return id;
}

/** Stores an uploaded photo as a candidate (stored already, so it is a local/public URL). */
export async function addUploadCandidate(q: Queryable, actor: Actor, productId: string, storedUrl: string) {
  const p = await identity(q, productId);
  const id = newId();
  await q.query(
    `insert into image_candidates (id, product_id, source, source_url, image_url, title, attribution, license, score, match_notes, created_by) values ($1,$2,'upload','',$3,$4,$5,$6,0,$7,$8)`,
    [id, productId, storedUrl, `${p.brand} ${p.name} (uploaded photo)`, `Uploaded by ${actor.name}`, "Shop's own photo", JSON.stringify(["uploaded by staff — check it's the exact size & flavour"]), actor.id],
  );
  await q.query("update products set image_status = 'REVIEW_REQUIRED', updated_at = now() where id = $1 and image_status <> 'APPROVED'", [productId]);
  await audit(q, actor, "image.uploaded", { type: "product", id: productId }, `Uploaded a photo for ${p.brand} ${p.name} (awaiting approval)`);
  return id;
}

/**
 * Approval = the only way a photo reaches the website. The caller passes the final stored URL
 * (remote candidates are downloaded, optimised and stored by the route before calling this).
 */
export async function approveCandidate(q: Queryable, actor: Actor, candidateId: string, storedUrl: string) {
  if (!can(actor.role, "images.review")) throw forbidden("Only the owner or a manager can approve product photos");
  const r = await q.query<{ product_id: string; status: string; title: string; source: string }>("select product_id, status, title, source from image_candidates where id = $1 for update", [candidateId]);
  if (!r[0]) throw notFound("Candidate not found");
  if (r[0].status === "rejected") throw conflict("This image was rejected");
  const prev = (await q.query<{ image: string; name: string }>("select image, name from products where id = $1 for update", [r[0].product_id]))[0];
  await q.query("update image_candidates set status = 'candidate' where product_id = $1 and status = 'approved'", [r[0].product_id]);
  await q.query("update image_candidates set status = 'approved', reviewed_by = $2, reviewed_at = now() where id = $1", [candidateId, actor.id]);
  await q.query("update products set image = $2, image_status = 'APPROVED', updated_at = now() where id = $1", [r[0].product_id, storedUrl]);
  await audit(q, actor, "image.approved", { type: "product", id: r[0].product_id }, `Approved photo for ${prev.name} (${r[0].source})`, { previous: prev.image || null, image: storedUrl, candidateId });
}

export async function rejectCandidate(q: Queryable, actor: Actor, candidateId: string, reason: string) {
  if (!can(actor.role, "images.review")) throw forbidden();
  const r = await q.query<{ product_id: string }>("update image_candidates set status = 'rejected', reviewed_by = $2, reviewed_at = now() where id = $1 and status = 'candidate' returning product_id", [candidateId, actor.id]);
  if (!r[0]) throw conflict("Only pending candidates can be rejected");
  const left = await q.query("select 1 from image_candidates where product_id = $1 and status = 'candidate' limit 1", [r[0].product_id]);
  if (!left.length) await q.query("update products set image_status = 'IMAGE_PENDING' where id = $1 and image_status = 'REVIEW_REQUIRED'", [r[0].product_id]);
  await audit(q, actor, "image.rejected", { type: "product", id: r[0].product_id }, `Rejected an image candidate${reason ? `: ${reason.slice(0, 100)}` : ""}`);
}

/** Owner/manager can take a photo off the website (e.g. wrong flavour shown). */
export async function unpublishImage(q: Queryable, actor: Actor, productId: string, reason: string) {
  if (!can(actor.role, "images.review")) throw forbidden();
  const r = await q.query<{ name: string; image: string }>("select name, image from products where id = $1", [productId]);
  if (!r[0]) throw notFound("Product not found");
  await q.query("update products set image_status = case when image <> '' then 'REVIEW_REQUIRED' else 'IMAGE_PENDING' end, updated_at = now() where id = $1", [productId]);
  await audit(q, actor, "image.unpublished", { type: "product", id: productId }, `Took photo of ${r[0].name} off the website: ${reason.slice(0, 120)}`, { image: r[0].image });
}

/** Optional advisory check with Gemini vision (free tier). Never approves anything by itself. */
export async function aiCheckCandidate(q: Queryable, candidateId: string, imageBytes: Buffer, mime: string, fetchImpl: typeof fetch = fetch) {
  if (!process.env.GEMINI_API_KEY) throw new AppError("AI image check needs GEMINI_API_KEY", 503);
  const c = (await q.query<{ product_id: string }>("select product_id from image_candidates where id = $1", [candidateId]))[0];
  if (!c) throw notFound("Candidate not found");
  const p = await identity(q, c.product_id);
  const prompt = `Look at this product photo. Does it show EXACTLY this product: brand "${p.brand}", product "${p.name}", size/pack "${p.label}"${p.flavour ? `, flavour "${p.flavour}"` : ""}?
Judge only from what is visibly printed on the package. Return JSON: {"brand":"yes|no|unsure","product":"yes|no|unsure","size":"yes|no|unsure","flavour":"yes|no|unsure|n/a","notes":"short reason"}`;
  const res = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(process.env.GEMINI_MODEL || "gemini-2.5-flash")}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }, { inline_data: { mime_type: mime, data: imageBytes.toString("base64") } }] }],
      generationConfig: { temperature: 0, responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) throw new AppError(`AI check failed (${res.status})`, 502);
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const result = JSON.parse((data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}").replace(/^```json|```$/g, ""));
  await q.query("update image_candidates set ai_check = $2 where id = $1", [candidateId, JSON.stringify({ ...result, checkedAt: new Date().toISOString(), advisory: true })]);
  return result;
}
