import { json, readJson, staffRoute } from "@/lib/api";
import { bad, notFound } from "@/lib/server/errors";
import { aiCheckCandidate, approveCandidate, fetchRemoteImage, rejectCandidate } from "@/lib/server/images";
import { revalidateStore } from "@/lib/server/revalidate";
import { savePublicImage, sniffType, UPLOAD_DIR } from "@/lib/server/storage";
import { promises as fs } from "node:fs";
import path from "node:path";

type P = { id: string };

/**
 * { action: "approve" } → downloads (if remote), optimises, stores and PUBLISHES the photo.
 * { action: "reject", reason? } | { action: "ai-check" } (advisory only)
 */
export const POST = staffRoute<P>("images.review", async (req, { db, actor, params }) => {
  const body = await readJson<{ action: string; reason?: string }>(req);
  const c = (await db.query<{ product_id: string; image_url: string; slug: string }>(
    "select c.product_id, c.image_url, p.slug from image_candidates c join products p on p.id = c.product_id where c.id = $1",
    [params.id],
  ))[0];
  if (!c) throw notFound("Candidate not found");

  if (body.action === "approve") {
    // uploaded photos are already stored; remote ones are copied into our own storage (optimised)
    const stored = c.image_url.startsWith("/uploads/") || c.image_url.includes("/storage/v1/object/public/") ? c.image_url : await savePublicImage(c.slug, await fetchRemoteImage(c.image_url));
    await db.tx((q) => approveCandidate(q, actor, params.id, stored));
    revalidateStore();
    return json({ ok: true, image: stored });
  }
  if (body.action === "reject") {
    await db.tx((q) => rejectCandidate(q, actor, params.id, String(body.reason ?? "")));
    return json({ ok: true });
  }
  if (body.action === "ai-check") {
    const bytes = c.image_url.startsWith("/uploads/")
      ? await fs.readFile(path.join(UPLOAD_DIR(), path.basename(c.image_url)))
      : await fetchRemoteImage(c.image_url);
    const mime = sniffType(bytes);
    if (!mime) throw bad("Unsupported image");
    return json({ result: await aiCheckCandidate(db, params.id, bytes, mime) });
  }
  return json({ error: "Unknown action" }, 400);
});
