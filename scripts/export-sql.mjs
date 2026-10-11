// Writes the database migrations (src/lib/db/migrations.ts) to supabase/migrations/*.sql
// for anyone who wants to run them by hand in the Supabase SQL editor.
// The app also applies them automatically on first start. Usage: npm run db:export-sql
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const src = readFileSync(path.join(process.cwd(), "src/lib/db/migrations.ts"), "utf8");
const re = /version:\s*"(\d+)",\s*name:\s*"([\w-]+)",\s*sql:\s*\/\* sql \*\/\s*`([\s\S]*?)`,\s*\}/g;
const out = path.join(process.cwd(), "supabase/migrations");
mkdirSync(out, { recursive: true });
let n = 0;
for (const m of src.matchAll(re)) {
  const file = path.join(out, `${m[1]}_${m[2]}.sql`);
  writeFileSync(file, `-- PowerX Nutrition migration ${m[1]} (${m[2]}) — generated from src/lib/db/migrations.ts\n-- Applied automatically by the app; safe to run once by hand in the Supabase SQL editor.\ncreate table if not exists schema_migrations (version text primary key, name text not null, applied_at timestamptz not null default now());\n\n${m[3].trim()}\n\ninsert into schema_migrations (version, name) values ('${m[1]}', '${m[2]}') on conflict do nothing;\n`);
  n++;
  console.log("wrote", path.relative(process.cwd(), file));
}
if (!n) {
  console.error("No migrations found — check the regex");
  process.exit(1);
}
