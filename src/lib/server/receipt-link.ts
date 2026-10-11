import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { siteConfig } from "@/config/site";

/**
 * Digital receipts are shared with customers as a link (e.g. on WhatsApp). The link carries a
 * signature so nobody can browse other people's bills by guessing numbers.
 */
const secret = () => `${process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || "px"}:receipt`;

export const receiptToken = (saleId: string) => createHmac("sha256", secret()).update(saleId).digest("base64url").slice(0, 22);

export function verifyReceiptToken(saleId: string, token: string) {
  const want = Buffer.from(receiptToken(saleId));
  const got = Buffer.from(String(token ?? ""));
  return want.length === got.length && timingSafeEqual(want, got);
}

export const receiptUrl = (saleId: string) => `${siteConfig.url}/r/${encodeURIComponent(saleId)}?t=${receiptToken(saleId)}`;

/** Direct link to the bill PDF (opens/downloads the PDF on the customer's phone). */
export const receiptPdfUrl = (saleId: string) => `${siteConfig.url}/r/${encodeURIComponent(saleId)}/pdf?t=${receiptToken(saleId)}`;
