import { json, readJson, staffRoute } from "@/lib/api";
import { can } from "@/lib/permissions";
import { bad, forbidden, notFound } from "@/lib/server/errors";
import { addUploadCandidate, addUrlCandidate, approveCandidate, findCandidates, listCandidates, unpublishImage } from "@/lib/server/images";
import { revalidateStore } from "@/lib/server/revalidate";
import { getSettings } from "@/lib/server/settings";
import { savePublicImage } from "@/lib/server/storage";

type P = { productId: string };

export const GET = staffRoute<P>(["images.review", "products.view"], async (_req, { db, params }) => {
  const p = (await db.query<{ id: string; slug: string; name: string; brand: string; image: string; image_status: string; status: string }>(
    "select id, slug, name, brand, image, image_status, status from products where id = $1",
    [params.productId],
  ))[0];
  if (!p) throw notFound("Product not found");
  const variants = await db.query<{ label: string; flavour: string; sku: string | null; barcode: string | null }>(
    "select label, flavour, sku, barcode from product_variants where product_id = $1 and active order by sort",
    [params.productId],
  );
  return json({ product: p, variants, candidates: await listCandidates(db, params.productId) });
});

/**
 * POST JSON { action: "search", force? } | { action: "link", imageUrl, sourceUrl?, note? } | { action: "unpublish", reason }
 * POST multipart (file) → uploads a photo: reviewers' uploads are approved immediately, others go to review.
 */
export const POST = staffRoute<P>(["images.review", "purchases.create", "products.edit"], async (req, { db, actor, params }) => {
  if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw bad("Choose a photo");
    const name = (await db.query<{ slug: string }>("select slug from products where id = $1", [params.productId]))[0]?.slug;
    if (!name) throw notFound("Product not found");
    const url = await savePublicImage(name, Buffer.from(await file.arrayBuffer()));
    const id = await db.tx(async (q) => {
      const cid = await addUploadCandidate(q, actor, params.productId, url);
      if (can(actor.role, "images.review") && form.get("approve") === "1") await approveCandidate(q, actor, cid, url);
      return cid;
    });
    revalidateStore();
    return json({ ok: true, candidateId: id, candidates: await listCandidates(db, params.productId) });
  }
  const body = await readJson<{ action: string; force?: boolean; imageUrl?: string; sourceUrl?: string; note?: string; reason?: string }>(req);
  if (body.action === "search") {
    const s = await getSettings(db);
    if (!s.ai.imageSearchEnabled) throw bad("Image search is switched off in Settings → AI & integrations");
    const r = await db.tx((q) => findCandidates(q, actor, params.productId, { force: body.force && can(actor.role, "images.review") }));
    return json(r);
  }
  if (body.action === "link") {
    await db.tx((q) => addUrlCandidate(q, actor, params.productId, String(body.imageUrl ?? ""), String(body.sourceUrl ?? ""), String(body.note ?? "")));
    return json({ candidates: await listCandidates(db, params.productId) });
  }
  if (body.action === "unpublish") {
    if (!can(actor.role, "images.review")) throw forbidden();
    await db.tx((q) => unpublishImage(q, actor, params.productId, String(body.reason ?? "")));
    revalidateStore();
    return json({ ok: true });
  }
  return json({ error: "Unknown action" }, 400);
});
