import { json, staffRoute } from "@/lib/api";
import { slugify } from "@/lib/product-input";
import { savePublicImage } from "@/lib/server/storage";

/**
 * Product photo upload from the product form (owner/manager). The photo is resized/converted to
 * WebP and stored; it is published when the product is saved with it.
 */
export const POST = staffRoute("images.review", async (req) => {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "No file received" }, 400);
  if (file.size > 8 * 1024 * 1024) return json({ error: "Image must be under 8 MB" }, 400);
  const base = slugify(String(form.get("slug") || file.name.replace(/\.[^.]+$/, ""))) || "product";
  const url = await savePublicImage(base, Buffer.from(await file.arrayBuffer()));
  return json({ url });
});
