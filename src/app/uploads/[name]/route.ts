import { promises as fs } from "node:fs";
import path from "node:path";
import { UPLOAD_DIR } from "@/lib/server/storage";

const TYPES: Record<string, string> = { webp: "image/webp", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", avif: "image/avif" };

/**
 * Serves approved product photos uploaded at runtime (Next.js only serves /public files that
 * existed at build time). File names are content-hashed, so they can be cached forever.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  if (!/^[a-z0-9._-]{1,120}$/i.test(name) || name.includes("..")) return new Response("Not found", { status: 404 });
  const ext = name.split(".").pop()!.toLowerCase();
  if (!TYPES[ext]) return new Response("Not found", { status: 404 });
  for (const dir of [UPLOAD_DIR(), path.join(process.cwd(), "public", "uploads")]) {
    try {
      const buf = await fs.readFile(path.join(dir, name));
      return new Response(new Uint8Array(buf), { headers: { "Content-Type": TYPES[ext], "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
    } catch {
      /* try next */
    }
  }
  return new Response("Not found", { status: 404 });
}
