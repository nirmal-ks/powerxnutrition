export { StoreError as AppError } from "@/lib/store/types";
import { StoreError } from "@/lib/store/types";

export const bad = (msg: string, extra?: Record<string, unknown>) => new StoreError(msg, 400, extra);
export const notFound = (msg = "Not found") => new StoreError(msg, 404);
export const conflict = (msg: string, extra?: Record<string, unknown>) => new StoreError(msg, 409, extra);
export const forbidden = (msg = "You don't have permission to do that") => new StoreError(msg, 403);
