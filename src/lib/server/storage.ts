import "server-only";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { AppError } from "./errors";

/**
 * File storage with two backends:
 *  - Supabase Storage (when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set): public bucket
 *    "product-images" for approved photos, PRIVATE bucket "private-files" for invoices/receipts.
 *  - Local disk otherwise: data/uploads (served by /uploads/[name]) and data/private (staff-only route).
 * Supplier invoices and expense receipts are never placed anywhere public.
 */
const SUPABASE_URL = () => process.env.SUPABASE_URL?.replace(/\/$/, "");
const SUPABASE_KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY;
const PUBLIC_BUCKET = "product-images";
const PRIVATE_BUCKET = "private-files";

export const UPLOAD_DIR = () => path.join(process.cwd(), "data", "uploads");
const PRIVATE_DIR = () => path.join(process.cwd(), "data", "private");

/**
 * Legacy service_role keys are JWTs ("eyJ…") and go in both headers. New Supabase secret keys
 * ("sb_secret_…") are not JWTs and must only be sent as `apikey`.
 */
const authHeaders = (): Record<string, string> => {
  const k = SUPABASE_KEY()!;
  return k.startsWith("eyJ") ? { apikey: k, Authorization: `Bearer ${k}` } : { apikey: k };
};

export const storageKind = () => (SUPABASE_URL() && SUPABASE_KEY() ? "supabase" : "local");

const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };

/** Detects the real file type from its first bytes (never trust the browser's MIME type or file name). */
export function sniffType(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "image/webp";
  if (buf.subarray(4, 12).toString().startsWith("ftypavi")) return "image/avif";
  if (buf.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
  return null;
}

async function supabaseUpload(bucket: string, name: string, contentType: string, bytes: Buffer) {
  const res = await fetch(`${SUPABASE_URL()}/storage/v1/object/${bucket}/${encodeURIComponent(name)}`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": contentType, "x-upsert": "true" },
    body: new Uint8Array(bytes),
  });
  if (!res.ok) throw new AppError(`File upload failed (${res.status}). Check the Supabase storage buckets (see README).`, 502);
}

async function writeLocal(dir: string, name: string, bytes: Buffer) {
  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, name), bytes);
  } catch {
    throw new AppError("This host can't save files. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to use Supabase Storage (see README).", 503);
  }
}

/**
 * Resizes to max 1200px and converts to WebP (keeps transparency). The photo itself is not
 * altered beyond size/format — packaging must stay accurate.
 */
export async function optimizeImage(bytes: Buffer): Promise<{ bytes: Buffer; type: string; ext: string }> {
  try {
    const sharp = (await import("sharp")).default;
    const out = await sharp(bytes, { failOn: "error" }).rotate().resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true }).webp({ quality: 84 }).toBuffer();
    return { bytes: out, type: "image/webp", ext: "webp" };
  } catch {
    const type = sniffType(bytes);
    if (!type || !IMAGE_TYPES[type]) throw new AppError("That file isn't a valid JPG, PNG, WEBP or AVIF image", 400);
    return { bytes, type, ext: IMAGE_TYPES[type] };
  }
}

/** Stores an approved product photo; returns its public URL. */
export async function savePublicImage(baseName: string, raw: Buffer) {
  const type = sniffType(raw);
  if (!type || !IMAGE_TYPES[type]) throw new AppError("Upload a JPG, PNG, WEBP or AVIF image", 400);
  if (raw.length > 8 * 1024 * 1024) throw new AppError("Image must be under 8 MB", 400);
  const img = await optimizeImage(raw);
  const safe = baseName.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || "product";
  const name = `${safe}-${createHash("sha1").update(img.bytes).digest("hex").slice(0, 10)}.${img.ext}`;
  if (storageKind() === "supabase") {
    await supabaseUpload(PUBLIC_BUCKET, name, img.type, img.bytes);
    return `${SUPABASE_URL()}/storage/v1/object/public/${PUBLIC_BUCKET}/${encodeURIComponent(name)}`;
  }
  await writeLocal(UPLOAD_DIR(), name, img.bytes);
  return `/uploads/${name}`;
}

/** Stores a private document (supplier invoice, expense receipt). Returns an opaque storage path. */
export async function savePrivateFile(kind: "invoices" | "receipts", name: string, contentType: string, bytes: Buffer) {
  const safe = name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-80);
  const key = `${kind}/${Date.now().toString(36)}-${safe}`;
  if (storageKind() === "supabase") {
    await supabaseUpload(PRIVATE_BUCKET, key, contentType, bytes);
    return `supabase:${key}`;
  }
  await writeLocal(path.join(PRIVATE_DIR(), kind), key.slice(kind.length + 1), bytes);
  return `local:${key}`;
}

export async function readPrivateFile(stored: string): Promise<Buffer> {
  const [kind, key] = [stored.slice(0, stored.indexOf(":")), stored.slice(stored.indexOf(":") + 1)];
  if (key.includes("..")) throw new AppError("Invalid file", 400);
  if (kind === "supabase") {
    const res = await fetch(`${SUPABASE_URL()}/storage/v1/object/authenticated/${PRIVATE_BUCKET}/${key}`, {
      headers: { ...authHeaders() },
    });
    if (!res.ok) throw new AppError("File not found", 404);
    return Buffer.from(await res.arrayBuffer());
  }
  try {
    return await fs.readFile(path.join(PRIVATE_DIR(), key));
  } catch {
    throw new AppError("File not found", 404);
  }
}

export const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");
