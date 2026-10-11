import "server-only";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { listProducts } from "./products";
import { writeCatalogSnapshot } from "@/lib/store";

let timer: ReturnType<typeof setTimeout> | null = null;

/**
 * Call after any COMMITTED change to products, prices or stock: refreshes the prerendered shop
 * pages (so customers see current availability) and the catalogue snapshot used by builds.
 */
export function revalidateStore() {
  try {
    revalidatePath("/", "layout");
  } catch {
    /* outside a request (tests/scripts) */
  }
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    timer = null;
    try {
      await writeCatalogSnapshot(await listProducts(await getDb(), { publishedOnly: true }));
    } catch (e) {
      console.error("[snapshot]", e);
    }
  }, 1500);
}
