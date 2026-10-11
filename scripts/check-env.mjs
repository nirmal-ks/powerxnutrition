#!/usr/bin/env node
/**
 * Checks environment variables before deploying (and on every Vercel build).
 *
 *   npm run check-env                 → checks .env.local for running on this PC
 *   npm run check-env -- --vercel     → checks what Vercel needs (DATABASE_URL, Supabase…)
 *   npm run check-env -- --vercel --connect → also connects to the database & Supabase Storage
 *
 * On Vercel this runs automatically before `next build` (package.json "vercel-build"), so a
 * deployment with a missing/wrong Supabase URL or key fails early with a clear message instead
 * of a broken live site. Emergency bypass: set SKIP_ENV_CHECK=1 in Vercel.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const args = new Set(process.argv.slice(2));
const onVercel = Boolean(process.env.VERCEL) || args.has("--vercel");
const connect = args.has("--connect");

if (process.env.SKIP_ENV_CHECK === "1") {
  console.log("⚠ SKIP_ENV_CHECK=1 — environment check skipped.");
  process.exit(0);
}

// Locally, read .env.local / .env (Vercel injects variables itself)
if (!process.env.VERCEL) {
  for (const f of [".env.local", ".env"]) {
    const file = path.join(process.cwd(), f);
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m || line.trim().startsWith("#")) continue;
      const v = m[2].replace(/^["']|["']$/g, "");
      if (process.env[m[1]] === undefined) process.env[m[1]] = v;
    }
  }
}

const env = (k) => (process.env[k] ?? "").trim();
// Vercel's Supabase integration names variables POSTGRES_URL / SUPABASE_URL …, optionally with a
// custom prefix (e.g. PowerXnutrition_POSTGRES_URL). Same rules as src/lib/env.ts.
const bySuffix = (suffix) => {
  for (const [k, v] of Object.entries(process.env)) if (v && k.endsWith(suffix) && !k.startsWith("NEXT_PUBLIC_")) return { k, v: v.trim() };
  return null;
};
const pick = (names, suffixes) => {
  for (const n of names) if (env(n)) return { k: n, v: env(n) };
  for (const s of suffixes) {
    const h = bySuffix(s);
    if (h) return h;
  }
  return { k: names[0], v: "" };
};
const errors = [];
const warnings = [];
const ok = [];
const err = (k, msg) => errors.push(`✖ ${k}: ${msg}`);
const warn = (k, msg) => warnings.push(`⚠ ${k}: ${msg}`);
const good = (k, msg = "ok") => ok.push(`✔ ${k}: ${msg}`);
const mask = (v) => (v.length <= 8 ? "****" : `${v.slice(0, 4)}…${v.slice(-4)}`);

// ---------------------------------------------------------------- always required
const pw = env("ADMIN_PASSWORD");
if (!pw) err("ADMIN_PASSWORD", "missing — needed to log in to /admin");
else if (["change-me", "admin", "password", "123456", "12345678"].includes(pw.toLowerCase())) err("ADMIN_PASSWORD", "is a placeholder/weak — set a strong password");
else if (pw.length < 10) warn("ADMIN_PASSWORD", "shorter than 10 characters — use a longer password in production");
else good("ADMIN_PASSWORD", "set");

const secret = env("ADMIN_SESSION_SECRET");
if (!secret) err("ADMIN_SESSION_SECRET", "missing — signs login cookies and customer receipt links");
else if (/replace-with|change-me/i.test(secret)) err("ADMIN_SESSION_SECRET", "is still the example value — use 64 random characters");
else if (secret.length < 32) err("ADMIN_SESSION_SECRET", `only ${secret.length} characters — use at least 32 (64 recommended)`);
else good("ADMIN_SESSION_SECRET", `${secret.length} characters`);

// secrets must never be NEXT_PUBLIC_ (those are sent to every browser)
for (const k of Object.keys(process.env)) {
  if (/^NEXT_PUBLIC_.*(SERVICE_ROLE|SECRET|PASSWORD|DATABASE_URL|GEMINI|RAZORPAY_KEY_SECRET|WHATSAPP_CLOUD_TOKEN)/.test(k)) {
    err(k, "secrets must NOT start with NEXT_PUBLIC_ (they would be visible to everyone). Rename it without the prefix.");
  }
}

// ---------------------------------------------------------------- site URL
const vercelDomain = env("VERCEL_PROJECT_PRODUCTION_URL") || env("NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL");
const site = env("NEXT_PUBLIC_SITE_URL") || (process.env.VERCEL && vercelDomain ? `https://${vercelDomain}` : "");
if (!site) (onVercel ? err : warn)("NEXT_PUBLIC_SITE_URL", "missing — receipt & WhatsApp PDF links need your public address");
else if (onVercel && (/localhost|127\.0\.0\.1|192\.168\./.test(site) || !site.startsWith("https://"))) {
  err("NEXT_PUBLIC_SITE_URL", `"${site}" — on Vercel use your public https address (e.g. https://powerxnutrition.in or https://<project>.vercel.app)`);
} else good("NEXT_PUBLIC_SITE_URL", site);

// ---------------------------------------------------------------- database
const dbPick = pick(["DATABASE_URL", "POSTGRES_URL"], ["_POSTGRES_URL"]);
const dbUrl = dbPick.v;
if (dbUrl && dbPick.k !== "DATABASE_URL") good("DATABASE_URL", `taken from ${dbPick.k} (Vercel Supabase integration)`);
let dbInfo = null;
if (!dbUrl) {
  if (onVercel) err("DATABASE_URL", "missing — Vercel has no permanent disk, so bills/stock would not be saved. Use Supabase → Project Settings → Database → Connection string → Transaction pooler");
  else good("DATABASE_URL", "empty → using the built-in local database in data/db (fine on this PC)");
} else {
  try {
    const u = new URL(dbUrl);
    if (!/^postgres(ql)?:$/.test(u.protocol)) throw new Error("must start with postgresql://");
    if (/\[YOUR-PASSWORD\]|YOUR-PASSWORD/i.test(dbUrl)) throw new Error("still contains [YOUR-PASSWORD] — paste your real database password");
    if (!u.password) throw new Error("has no password");
    dbInfo = u;
    const supa = /supabase\.(co|com)$/.test(u.hostname);
    if (supa && u.hostname.startsWith("db.") && onVercel) {
      warn("DATABASE_URL", "uses the DIRECT connection (db.xxx.supabase.co:5432). On Vercel use the Transaction pooler URI (…pooler.supabase.com:6543) — direct is IPv6-only and can fail");
    } else if (supa && u.port === "5432" && u.hostname.includes("pooler") && onVercel) {
      warn("DATABASE_URL", "uses the Session pooler (5432). For Vercel the Transaction pooler (port 6543) handles many short connections better");
    }
    good("DATABASE_URL", `${u.username}@${u.hostname}:${u.port || 5432}${u.pathname} (password ${mask(decodeURIComponent(u.password))})`);
  } catch (e) {
    err("DATABASE_URL", e.message);
  }
}

// ---------------------------------------------------------------- Supabase storage
const sUrlPick = pick(["SUPABASE_URL"], ["_SUPABASE_URL"]);
const sKeyPick = pick(["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"], ["_SUPABASE_SERVICE_ROLE_KEY", "_SUPABASE_SECRET_KEY"]);
const sUrl = sUrlPick.v.replace(/\/$/, "");
const sKey = sKeyPick.v;
if (sUrl && sUrlPick.k !== "SUPABASE_URL") good("SUPABASE_URL", `taken from ${sUrlPick.k}`);
if (sKey && sKeyPick.k !== "SUPABASE_SERVICE_ROLE_KEY") good("SUPABASE_SERVICE_ROLE_KEY", `taken from ${sKeyPick.k}`);
let storageOk = false;
if (!sUrl && !sKey) {
  if (onVercel) err("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY", "missing — Vercel can't store product photos or supplier invoices on disk. Supabase → Project Settings → API");
  else good("SUPABASE_URL", "empty → photos & invoices stored on this PC (data/uploads, data/private)");
} else {
  if (!sUrl) err("SUPABASE_URL", "missing (SUPABASE_SERVICE_ROLE_KEY is set)");
  else if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(sUrl)) {
    if (/\/rest\/v1|\/storage\/v1/.test(sUrl)) err("SUPABASE_URL", `"${sUrl}" — use only the project URL, e.g. https://abcd1234.supabase.co (no /rest/v1 path)`);
    else if (!sUrl.startsWith("https://")) err("SUPABASE_URL", "must start with https://");
    else warn("SUPABASE_URL", `"${sUrl}" doesn't look like https://<project-ref>.supabase.co — ok only for self-hosted Supabase`);
  } else good("SUPABASE_URL", sUrl);

  if (!sKey) err("SUPABASE_SERVICE_ROLE_KEY", "missing (SUPABASE_URL is set)");
  else if (sKey.startsWith("sb_publishable_")) err("SUPABASE_SERVICE_ROLE_KEY", "this is the PUBLISHABLE (public) key — use the SECRET key (sb_secret_…) or the legacy service_role key");
  else if (sKey.startsWith("sb_secret_")) {
    good("SUPABASE_SERVICE_ROLE_KEY", `secret key ${mask(sKey)}`);
    storageOk = Boolean(sUrl);
  } else if (sKey.startsWith("eyJ")) {
    try {
      const payload = JSON.parse(Buffer.from(sKey.split(".")[1], "base64url").toString());
      if (payload.role === "anon") err("SUPABASE_SERVICE_ROLE_KEY", "this is the ANON (public) key — copy the service_role key instead");
      else if (payload.role !== "service_role") err("SUPABASE_SERVICE_ROLE_KEY", `JWT role is "${payload.role}" — expected service_role`);
      else {
        const ref = sUrl.match(/^https:\/\/([a-z0-9-]+)\.supabase\.co/)?.[1];
        if (ref && payload.ref && payload.ref !== ref) err("SUPABASE_SERVICE_ROLE_KEY", `belongs to project "${payload.ref}" but SUPABASE_URL is project "${ref}"`);
        else {
          good("SUPABASE_SERVICE_ROLE_KEY", `service_role key for ${payload.ref ?? "project"} ${mask(sKey)}`);
          storageOk = Boolean(sUrl);
        }
      }
    } catch {
      err("SUPABASE_SERVICE_ROLE_KEY", "looks like a JWT but can't be read — copy it again without spaces/line breaks");
    }
  } else err("SUPABASE_SERVICE_ROLE_KEY", "unrecognised format — expected sb_secret_… or a service_role JWT (eyJ…)");

  if (dbInfo && sUrl) {
    const ref = sUrl.match(/^https:\/\/([a-z0-9-]+)\.supabase\.co/)?.[1];
    const inDb = dbInfo.username.includes(".") ? dbInfo.username.split(".")[1] : dbInfo.hostname.match(/^db\.([a-z0-9-]+)\./)?.[1];
    if (ref && inDb && ref !== inDb) err("DATABASE_URL", `is for Supabase project "${inDb}" but SUPABASE_URL is project "${ref}" — both must be the same project`);
  }
}

// ---------------------------------------------------------------- optional integrations (all-or-nothing)
const group = (name, keys, hint) => {
  const set = keys.filter((k) => env(k));
  if (set.length && set.length < keys.length) err(name, `partly configured — also set ${keys.filter((k) => !env(k)).join(", ")}. ${hint}`);
  else if (set.length) good(name, "configured");
};
group("Razorpay", ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"], "Or leave all Razorpay values empty (UPI QR + COD still work).");
if (env("RAZORPAY_KEY_ID") && !env("RAZORPAY_WEBHOOK_SECRET")) warn("RAZORPAY_WEBHOOK_SECRET", "not set — payments still verify at checkout, but late/failed payments won't update automatically");
group("WhatsApp auto-send", ["WHATSAPP_CLOUD_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_BILL_TEMPLATE"], "Or leave all empty to use free wa.me links.");
group("Google image search", ["GOOGLE_CSE_KEY", "GOOGLE_CSE_CX"], "Or leave both empty (Open Food Facts is used).");
if (env("AI_BASE_URL") && !env("AI_MODEL")) err("AI_MODEL", "set AI_MODEL together with AI_BASE_URL");
if (env("GEMINI_API_KEY")) good("GEMINI_API_KEY", `set ${mask(env("GEMINI_API_KEY"))} (owner must allow it in Settings → AI)`);
if (onVercel && /localhost|127\.0\.0\.1/.test(env("AI_BASE_URL"))) err("AI_BASE_URL", "points to localhost — Vercel can't reach the shop PC's Ollama. Use GEMINI_API_KEY instead");

// ---------------------------------------------------------------- live connection checks
async function liveChecks() {
  if (dbUrl && !errors.some((e) => e.includes("DATABASE_URL"))) {
    try {
      const { default: pg } = await import("pg");
      const client = new pg.Client({
        connectionString: (() => {
          const u = new URL(dbUrl);
          u.searchParams.delete("sslmode"); // same as the app: TLS configured below
          return u.toString();
        })(),
        ssl: /localhost|127\.0\.0\.1|sslmode=disable/.test(dbUrl) ? undefined : { rejectUnauthorized: false },
        connectionTimeoutMillis: 10000,
      });
      await client.connect();
      const r = await client.query("select version() as v, (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'products')::int as m");
      await client.end();
      good("Database connection", `${String(r.rows[0].v).split(" ").slice(0, 2).join(" ")}${r.rows[0].m ? " · tables already created" : " · empty (tables are created on first start)"}`);
    } catch (e) {
      const m = String(e.message);
      err(
        "Database connection",
        /password authentication/i.test(m)
          ? "wrong database password in DATABASE_URL (Supabase → Project Settings → Database → Reset password)"
          : /ENOTFOUND|getaddrinfo/i.test(m)
            ? "host not found — check the URL; a paused Supabase project must be restored first"
            : /Tenant or user not found/i.test(m)
              ? "pooler user must look like postgres.<project-ref> — copy the pooler URI again"
              : m,
      );
    }
  }
  if (storageOk) {
    try {
      const headers = sKey.startsWith("eyJ") ? { apikey: sKey, Authorization: `Bearer ${sKey}` } : { apikey: sKey };
      const res = await fetch(`${sUrl}/storage/v1/bucket`, { headers, signal: AbortSignal.timeout(10000) });
      if (res.status === 401 || res.status === 403) throw new Error("key rejected by Supabase (wrong project or not the secret/service_role key)");
      if (!res.ok) throw new Error(`Supabase answered ${res.status}`);
      const buckets = await res.json();
      const pub = buckets.find((b) => b.id === "product-images");
      const priv = buckets.find((b) => b.id === "private-files");
      if (!pub || !priv) err("Supabase Storage", `missing bucket(s): ${[!pub && "product-images", !priv && "private-files"].filter(Boolean).join(", ")} — run supabase/schema.sql in the Supabase SQL editor`);
      else if (!pub.public) err("Supabase Storage", "bucket product-images must be PUBLIC (photos are shown on the website)");
      else if (priv.public) err("Supabase Storage", "bucket private-files must be PRIVATE (it holds supplier invoices)");
      else good("Supabase Storage", "buckets product-images (public) + private-files (private) found");
    } catch (e) {
      err("Supabase Storage", e.message);
    }
  }
}

if (connect) await liveChecks();

console.log(`\nPowerX environment check — ${onVercel ? "Vercel / production" : "this PC"}${connect ? " (with live connection test)" : ""}\n`);
for (const l of ok) console.log(l);
for (const l of warnings) console.log(l);
for (const l of errors) console.log(l);
console.log("");
if (errors.length) {
  console.log(`✖ ${errors.length} problem(s) — fix them${process.env.VERCEL ? " in Vercel → Project → Settings → Environment Variables, then redeploy" : ""}. See README → Deployment.\n`);
  process.exitCode = 1;
} else {
  console.log(`✔ All good${warnings.length ? ` (${warnings.length} warning(s))` : ""}.\n`);
}
