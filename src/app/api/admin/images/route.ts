import { json, searchParams, staffRoute } from "@/lib/api";
import { googleConfigured, imageQueue } from "@/lib/server/images";
import { getSettings } from "@/lib/server/settings";

/** Review queue: products whose photo is pending / needs review (or ?status=APPROVED). */
export const GET = staffRoute(["images.review", "products.view"], async (req, { db }) => {
  const s = await getSettings(db);
  return json({
    products: await imageQueue(db, searchParams(req).get("status") ?? undefined),
    sources: { openFoodFacts: s.ai.imageSearchEnabled, google: s.ai.imageSearchEnabled && googleConfigured(), aiCheck: s.ai.aiImageCheck && Boolean(process.env.GEMINI_API_KEY) },
  });
});
