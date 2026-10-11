import { cookies } from "next/headers";
import { ADMIN_COOKIE, adminConfigured, login } from "@/lib/auth";
import { errorResponse, json } from "@/lib/api";

export async function POST(req: Request) {
  try {
    if (!adminConfigured()) return json({ error: "Set ADMIN_PASSWORD in your environment variables first." }, 503);
    const { username, password } = (await req.json().catch(() => ({}))) as { username?: string; password?: string };
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
    const result = await login(String(username ?? ""), String(password ?? ""), ip);
    if ("error" in result) {
      await new Promise((r) => setTimeout(r, 700)); // slow down guessing
      return json({ error: result.error }, 401);
    }
    (await cookies()).set(ADMIN_COOKIE, result.token, {
      httpOnly: true,
      // Secure on https (Vercel etc.), but still works on http://localhost / LAN testing from a phone
      secure: (req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "")) === "https",
      sameSite: "lax",
      path: "/",
      maxAge: result.maxAge,
    });
    return json({ ok: true, name: result.name });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE() {
  (await cookies()).delete(ADMIN_COOKIE);
  return json({ ok: true });
}
