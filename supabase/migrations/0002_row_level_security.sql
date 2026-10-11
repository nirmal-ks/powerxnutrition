-- PowerX Nutrition migration 0002 (row_level_security) — generated from src/lib/db/migrations.ts
-- Applied automatically by the app; safe to run once by hand in the Supabase SQL editor.
create table if not exists schema_migrations (version text primary key, name text not null, applied_at timestamptz not null default now());

-- On Supabase the browser-facing "anon" key must never reach these tables. RLS ON with no
-- policies = deny everything to anon/authenticated roles; the server connects as the database
-- owner (DATABASE_URL), which bypasses RLS. Harmless on plain Postgres / PGlite.
do $$
declare t text;
begin
  foreach t in array array['settings','counters','staff','suppliers','products','product_variants','customers',
    'purchases','purchase_items','batches','orders','sales','sale_items','sale_returns','sale_return_items',
    'payments','inventory_movements','expenses','stock_imports','invoice_imports','image_candidates',
    'coupons','reviews','audit_logs']
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

insert into schema_migrations (version, name) values ('0002', 'row_level_security') on conflict do nothing;
