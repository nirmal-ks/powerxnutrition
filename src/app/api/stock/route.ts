import { errorResponse, json } from "@/lib/api";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Live availability for a product page (prerendered pages may be a few minutes old). */
export async function GET(req: Request) {
  try {
    const slug = new URL(req.url).searchParams.get("slug") ?? "";
    if (!/^[a-z0-9-]{1,90}$/.test(slug)) return json({ error: "Bad slug" }, 400);
    const db = await getDb();
    const rows = await db.query<{ code: string; stock: number; price: number }>(
      `select v.code, v.stock, v.price from product_variants v join products p on p.id = v.product_id
       where p.slug = $1 and p.status = 'published' and v.active`,
      [slug],
    );
    return json(
      { checkedAt: new Date().toISOString(), variants: Object.fromEntries(rows.map((r) => [r.code, { stock: Math.max(0, r.stock), price: r.price }])) },
      200,
    );
  } catch (e) {
    return errorResponse(e);
  }
}
