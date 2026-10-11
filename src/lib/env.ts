/**
 * Server settings that can come from our own names OR from Vercel's Supabase integration,
 * which creates variables like POSTGRES_URL / SUPABASE_URL, optionally with a custom prefix
 * (e.g. "PowerXnutrition_POSTGRES_URL"). Our own names always win.
 * Keep in sync with scripts/check-env.mjs.
 */
function bySuffix(suffix: string): string | undefined {
  for (const [k, v] of Object.entries(process.env)) {
    if (v && k.endsWith(suffix) && !k.startsWith("NEXT_PUBLIC_")) return v.trim();
  }
  return undefined;
}

const own = (k: string) => process.env[k]?.trim() || undefined;

/** Postgres connection string (pooled). Empty → local PGlite. */
export const databaseUrl = () => own("DATABASE_URL") ?? own("POSTGRES_URL") ?? bySuffix("_POSTGRES_URL");

export const supabaseUrl = () => (own("SUPABASE_URL") ?? bySuffix("_SUPABASE_URL"))?.replace(/\/$/, "");

export const supabaseServiceKey = () =>
  own("SUPABASE_SERVICE_ROLE_KEY") ?? own("SUPABASE_SECRET_KEY") ?? bySuffix("_SUPABASE_SERVICE_ROLE_KEY") ?? bySuffix("_SUPABASE_SECRET_KEY");
