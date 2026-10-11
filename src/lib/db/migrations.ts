/**
 * Database migrations, applied automatically (in order, once each) the first time the server
 * touches the database. The same SQL is exported to supabase/migrations/*.sql by
 * `npm run db:export-sql` for anyone who prefers to run it by hand in the Supabase SQL editor.
 *
 * Rules: never edit a migration that has shipped — add a new one.
 * Money = numeric(12,2). Quantities = integer. Timestamps = timestamptz (UTC); "business day" uses IST.
 */
export interface Migration {
  version: string;
  name: string;
  sql: string;
}

export const migrations: Migration[] = [
  {
    version: "0001",
    name: "core",
    sql: /* sql */ `
-- India has no daylight saving, so IST = UTC+05:30 always. Used for "today", daily reports, bill years.
create or replace function ist_date(t timestamptz) returns date
  language sql immutable as $$ select ((t at time zone 'UTC') + interval '330 minutes')::date $$;

create table if not exists settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  text
);

create table if not exists counters (
  key    text primary key,
  value  integer not null default 0
);

-- ---------------------------------------------------------------- staff & roles
create table if not exists staff (
  id               text primary key,
  username         text not null unique,
  name             text not null,
  role             text not null check (role in ('owner','manager','cashier','inventory')),
  password_hash    text not null,
  active           boolean not null default true,
  session_version  integer not null default 1,
  phone            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------- suppliers
create table if not exists suppliers (
  id          text primary key,
  name        text not null,
  name_key    text not null unique,          -- normalised name: blocks exact duplicates
  phone       text not null default '',
  email       text not null default '',
  gstin       text not null default '',
  address     text not null default '',
  notes       text not null default '',
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- products (master data)
create table if not exists products (
  id                   text primary key,
  slug                 text not null unique,
  name                 text not null,
  brand                text not null,
  category             text not null,
  description          text not null default '',
  image                text not null default '',            -- the APPROVED, published image
  image_status         text not null default 'IMAGE_PENDING'
                         check (image_status in ('IMAGE_PENDING','REVIEW_REQUIRED','APPROVED')),
  status               text not null default 'published'
                         check (status in ('draft','published','archived')),
  featured             boolean not null default false,
  sort                 integer not null default 999,
  hsn                  text not null default '',
  gst_rate             numeric(5,2) check (gst_rate is null or (gst_rate >= 0 and gst_rate <= 40)),
  default_supplier_id  text references suppliers(id) on delete set null,
  track_expiry         boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists products_status_idx on products (status, sort);
create index if not exists products_brand_idx on products (lower(brand));

create table if not exists product_variants (
  id          text primary key,
  product_id  text not null references products(id) on delete cascade,
  code        text not null,                   -- stable id used by the storefront cart (e.g. "1-kg")
  label       text not null,                   -- size / pack
  flavour     text not null default '',
  sku         text,
  barcode     text,
  price       numeric(12,2) not null check (price >= 0),
  mrp         numeric(12,2) not null check (mrp >= 0),
  stock       integer not null default 0,      -- live on-hand quantity; only changed with a movement row
  avg_cost    numeric(12,2) check (avg_cost is null or avg_cost >= 0),   -- weighted average purchase cost
  last_cost   numeric(12,2),
  min_stock   integer not null default 2 check (min_stock >= 0),
  active      boolean not null default true,
  sort        integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (product_id, code)
);
create unique index if not exists product_variants_sku_uq on product_variants (upper(sku)) where sku is not null and sku <> '';
create unique index if not exists product_variants_barcode_uq on product_variants (barcode) where barcode is not null and barcode <> '';
create index if not exists product_variants_product_idx on product_variants (product_id);

-- ---------------------------------------------------------------- customers
create table if not exists customers (
  id          text primary key,
  phone       text not null unique,
  name        text not null default '',
  email       text not null default '',
  address     jsonb,
  notes       text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- purchases (stock receiving)
create table if not exists purchases (
  id                          text primary key,
  purchase_no                 text not null unique,
  supplier_id                 text not null references suppliers(id),
  supplier_invoice_no         text not null default '',
  invoice_date                date,
  status                      text not null default 'draft' check (status in ('draft','confirmed','cancelled')),
  source                      text not null default 'manual' check (source in ('manual','csv','invoice')),
  notes                       text not null default '',
  subtotal                    numeric(12,2) not null default 0,
  discount_total              numeric(12,2) not null default 0,
  tax_total                   numeric(12,2) not null default 0,
  other_charges               numeric(12,2) not null default 0,
  total                       numeric(12,2) not null default 0,
  paid_amount                 numeric(12,2) not null default 0,
  duplicate_override_reason   text,
  invoice_import_id           text,
  stock_import_id             text,
  created_by                  text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  confirmed_by                text,
  confirmed_at                timestamptz
);
-- The same supplier invoice can only be received once (unless the owner overrides with a reason).
create unique index if not exists purchases_invoice_uq on purchases (supplier_id, lower(supplier_invoice_no))
  where status = 'confirmed' and supplier_invoice_no <> '' and duplicate_override_reason is null;
create index if not exists purchases_created_idx on purchases (created_at desc);

create table if not exists purchase_items (
  id            text primary key,
  purchase_id   text not null references purchases(id) on delete cascade,
  line_no       integer not null,
  variant_id    text references product_variants(id),
  new_product   jsonb,                 -- draft of a product to create on confirmation (imports)
  description   text not null default '',
  qty           integer not null check (qty > 0),
  unit_cost     numeric(12,2) not null check (unit_cost >= 0),
  tax_rate      numeric(5,2),
  tax_amount    numeric(12,2) not null default 0,
  line_total    numeric(12,2) not null default 0,
  batch_no      text not null default '',
  mfg_date      date,
  expiry_date   date,
  batch_id      text
);
create index if not exists purchase_items_purchase_idx on purchase_items (purchase_id);
create index if not exists purchase_items_variant_idx on purchase_items (variant_id);

create table if not exists batches (
  id             text primary key,
  variant_id     text not null references product_variants(id),
  batch_no       text not null default '',
  mfg_date       date,
  expiry_date    date,
  unit_cost      numeric(12,2),
  qty_received   integer not null check (qty_received >= 0),
  qty_remaining  integer not null check (qty_remaining >= 0),
  purchase_id    text references purchases(id),
  supplier_id    text references suppliers(id),
  received_at    timestamptz not null default now()
);
create index if not exists batches_variant_idx on batches (variant_id, expiry_date);

-- ---------------------------------------------------------------- online orders (fulfilment record)
create table if not exists orders (
  id               text primary key,
  data             jsonb not null,
  status           text not null default 'new',
  payment_status   text not null default 'unpaid',
  phone            text,
  total            numeric(12,2) not null default 0,
  client_key       text unique,              -- idempotency key from the checkout page
  stock_deducted   boolean not null default false,
  sale_id          text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists orders_created_idx on orders (created_at desc);
create index if not exists orders_phone_idx on orders (phone);

-- ---------------------------------------------------------------- sales (financial record, online + offline)
create table if not exists sales (
  id                text primary key,
  bill_no           text not null unique,
  channel           text not null check (channel in ('ONLINE','OFFLINE')),
  order_id          text unique references orders(id),
  client_txn_id     text unique,              -- idempotency: the POS sends one per bill
  customer_id       text references customers(id),
  customer_name     text not null default '',
  customer_phone    text not null default '',
  status            text not null default 'completed'
                      check (status in ('completed','partially_returned','returned','cancelled')),
  document_type     text not null default 'receipt' check (document_type in ('receipt','tax_invoice')),
  tax_mode          text not null default 'none' check (tax_mode in ('none','inclusive','exclusive')),
  place_of_supply   text not null default '',
  subtotal          numeric(12,2) not null,   -- list price × qty (before discount)
  discount          numeric(12,2) not null default 0,
  taxable_value     numeric(12,2) not null,   -- net sales excl. tax
  cgst              numeric(12,2) not null default 0,
  sgst              numeric(12,2) not null default 0,
  igst              numeric(12,2) not null default 0,
  tax_total         numeric(12,2) not null default 0,
  delivery          numeric(12,2) not null default 0,
  round_off         numeric(12,2) not null default 0,
  total             numeric(12,2) not null,
  payment_status    text not null default 'paid' check (payment_status in ('paid','partial','unpaid','refunded')),
  business          jsonb,                    -- seller details as printed at the time of sale
  notes             text not null default '',
  cashier_id        text,
  cashier_name      text not null default '',
  created_at        timestamptz not null default now(),
  offline_created_at timestamptz             -- set when the bill was made offline and synced later
);
create index if not exists sales_created_idx on sales (created_at desc);
create index if not exists sales_channel_idx on sales (channel, created_at desc);
create index if not exists sales_phone_idx on sales (customer_phone);

create table if not exists sale_items (
  id              text primary key,
  sale_id         text not null references sales(id) on delete restrict,
  line_no         integer not null,
  variant_id      text not null references product_variants(id),
  product_name    text not null,
  variant_label   text not null,
  sku             text not null default '',
  hsn             text not null default '',
  qty             integer not null check (qty > 0),
  unit_price      numeric(12,2) not null,
  discount        numeric(12,2) not null default 0,
  taxable_value   numeric(12,2) not null,
  tax_rate        numeric(5,2) not null default 0,
  tax_amount      numeric(12,2) not null default 0,
  line_total      numeric(12,2) not null,
  unit_cost       numeric(12,2),             -- historical cost basis frozen at sale time (null = unknown)
  returned_qty    integer not null default 0,
  check (returned_qty >= 0 and returned_qty <= qty)
);
create index if not exists sale_items_sale_idx on sale_items (sale_id);
create index if not exists sale_items_variant_idx on sale_items (variant_id);

create table if not exists sale_returns (
  id             text primary key,
  return_no      text not null unique,
  sale_id        text not null references sales(id),
  kind           text not null check (kind in ('return','void')),
  reason         text not null,
  refund_amount  numeric(12,2) not null default 0,
  refund_method  text not null default '',
  client_txn_id  text unique,
  created_by     text,
  created_by_name text not null default '',
  created_at     timestamptz not null default now()
);

create table if not exists sale_return_items (
  id             text primary key,
  return_id      text not null references sale_returns(id),
  sale_item_id   text not null references sale_items(id),
  qty            integer not null check (qty > 0),
  refund_amount  numeric(12,2) not null,
  taxable_value  numeric(12,2) not null,
  tax_amount     numeric(12,2) not null,
  unit_cost      numeric(12,2),
  restock        boolean not null default true
);

create table if not exists payments (
  id                  text primary key,
  sale_id             text references sales(id),
  order_id            text references orders(id),
  return_id           text references sale_returns(id),
  direction           text not null default 'in' check (direction in ('in','out')),
  method              text not null check (method in ('cash','upi','card','cod','razorpay','other')),
  amount              numeric(12,2) not null check (amount >= 0),
  status              text not null check (status in ('pending','received','verifying','verified','failed','refunded')),
  reference           text not null default '',
  gateway_order_id    text,
  gateway_payment_id  text unique,
  recorded_by         text,
  notes               text not null default '',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists payments_sale_idx on payments (sale_id);
create index if not exists payments_order_idx on payments (order_id);

-- ---------------------------------------------------------------- inventory ledger
create table if not exists inventory_movements (
  id           bigserial primary key,
  variant_id   text not null references product_variants(id),
  qty_change   integer not null check (qty_change <> 0),
  type         text not null check (type in ('OPENING','PURCHASE_RECEIPT','SALE_OFFLINE','SALE_ONLINE',
                                             'RETURN','CANCELLATION','ADJUSTMENT')),
  ref_type     text not null,               -- sale | order | purchase | return | adjustment | opening
  ref_id       text not null,
  ref_line     text not null default '',    -- sale_item / purchase_item id
  batch_id     text references batches(id),
  unit_cost    numeric(12,2),
  stock_after  integer not null,
  user_id      text,
  user_name    text not null default '',
  note         text not null default '',
  created_at   timestamptz not null default now()
);
-- Database-level guard: one transaction line can only move stock once per batch.
create unique index if not exists inventory_movements_once_uq
  on inventory_movements (ref_type, ref_id, ref_line, coalesce(batch_id, ''), type);
create index if not exists inventory_movements_variant_idx on inventory_movements (variant_id, created_at desc);
create index if not exists inventory_movements_created_idx on inventory_movements (created_at desc);

-- ---------------------------------------------------------------- expenses
create table if not exists expenses (
  id              text primary key,
  expense_date    date not null,
  category        text not null,
  amount          numeric(12,2) not null check (amount > 0),
  description     text not null default '',
  payment_method  text not null default '',
  receipt_path    text,
  created_by      text,
  created_by_name text not null default '',
  created_at      timestamptz not null default now(),
  voided          boolean not null default false,
  voided_by       text,
  void_reason     text
);
create index if not exists expenses_date_idx on expenses (expense_date desc);

-- ---------------------------------------------------------------- imports & AI review
create table if not exists stock_imports (
  id            text primary key,
  file_name     text not null,
  status        text not null default 'preview' check (status in ('preview','confirmed','discarded','failed')),
  supplier_id   text references suppliers(id),
  rows          jsonb not null,
  summary       jsonb,
  purchase_id   text references purchases(id),
  error         text,
  created_by    text,
  created_at    timestamptz not null default now(),
  confirmed_at  timestamptz
);

create table if not exists invoice_imports (
  id             text primary key,
  status         text not null default 'uploaded'
                   check (status in ('uploaded','extracted','failed','confirmed','discarded')),
  file_path      text not null,
  file_name      text not null,
  mime           text not null,
  size_bytes     integer not null,
  file_hash      text not null,
  provider       text not null default '',
  raw_text       text,
  extracted      jsonb,                     -- exactly what the extractor returned (with confidence)
  review         jsonb,                     -- staff-corrected version
  warnings       jsonb,
  supplier_id    text references suppliers(id),
  invoice_no     text not null default '',
  purchase_id    text references purchases(id),
  error          text,
  created_by     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists invoice_imports_hash_idx on invoice_imports (file_hash);

create table if not exists image_candidates (
  id            text primary key,
  product_id    text not null references products(id) on delete cascade,
  source        text not null,              -- openfoodfacts | google | url | upload
  source_url    text not null default '',
  image_url     text not null,
  title         text not null default '',
  attribution   text not null default '',
  license       text not null default '',
  score         numeric(5,2) not null default 0,
  match_notes   jsonb,
  ai_check      jsonb,
  status        text not null default 'candidate' check (status in ('candidate','approved','rejected')),
  created_by    text,
  created_at    timestamptz not null default now(),
  reviewed_by   text,
  reviewed_at   timestamptz
);
create index if not exists image_candidates_product_idx on image_candidates (product_id, status);

-- ---------------------------------------------------------------- coupons & reviews (unchanged shape)
create table if not exists coupons (
  code        text primary key,
  data        jsonb not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists reviews (
  id          text primary key,
  data        jsonb not null,
  slug        text not null,
  status      text not null default 'pending',
  rating      smallint not null default 5,
  created_at  timestamptz not null default now()
);
create index if not exists reviews_slug_idx on reviews (slug, status);

-- ---------------------------------------------------------------- audit log (append-only)
create table if not exists audit_logs (
  id           bigserial primary key,
  at           timestamptz not null default now(),
  user_id      text,
  user_name    text not null default '',
  role         text not null default '',
  action       text not null,
  entity_type  text not null default '',
  entity_id    text not null default '',
  summary      text not null default '',
  details      jsonb
);
create index if not exists audit_logs_at_idx on audit_logs (at desc);
create index if not exists audit_logs_entity_idx on audit_logs (entity_type, entity_id);

create or replace function audit_logs_append_only() returns trigger language plpgsql as $$
begin
  raise exception '% is append-only: history rows cannot be changed or deleted', tg_table_name;
end $$;
drop trigger if exists audit_logs_no_update on audit_logs;
create trigger audit_logs_no_update before update or delete on audit_logs
  for each row execute function audit_logs_append_only();

-- Movements are history too: never edited or deleted (reversals are new rows).
drop trigger if exists inventory_movements_no_update on inventory_movements;
create trigger inventory_movements_no_update before update or delete on inventory_movements
  for each row execute function audit_logs_append_only();
`,
  },
  {
    version: "0002",
    name: "row_level_security",
    sql: /* sql */ `
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
`,
  },
];
