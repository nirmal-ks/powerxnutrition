# PowerX Nutrition — Website + Shop Billing (POS) + Inventory

Next.js 16 + TypeScript + Tailwind CSS 4. One system for:

- **Online store**: catalogue, cart, checkout, UPI QR, COD, WhatsApp ordering, optional Razorpay, order tracking.
- **Shop billing (POS)** on any phone, tablet or PC. No app to install, and a printer is optional.
- **One shared inventory**: online orders, shop bills, purchases and returns all move the same stock, and every change is recorded.
- **Stock receiving** by a quick mobile form, **Excel/CSV import**, or **AI supplier-invoice scanning**.
- **Product photos**: free image search, then approval by staff before anything appears on the site.
- **Owner dashboard and reports**: net sales, cost of goods, gross profit, expenses, estimated operating profit, CSV export.
- **Staff logins with roles**, a **GST-ready** billing setup, and an **activity log** nobody can edit.

Everything works **without paid services**. WhatsApp sharing uses free `wa.me` links (staff review each message and press send). AI uses Google Gemini's free tier, or a fully local Ollama, or a no-AI text reader built into the browser.

---

## 1. Quick start (shop PC / laptop)

```bash
npm install
npm run dev          # http://localhost:3000   (phones on the same Wi-Fi: http://<PC-IP>:3000)
```

Admin: **http://localhost:3000/admin**. Username `owner`, password = `ADMIN_PASSWORD` in `.env.local`.

On the first start the app creates its database in `data/db` (real PostgreSQL via PGlite, nothing to install). It then imports `data/products.json`, `data/orders.json`, coupons and reviews automatically. Existing stock becomes "opening stock", and existing photos stay published.

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` then `npm start` | Production build and run (use this in the shop) |
| `npm test` | Automated tests (79 tests, in-memory database) |
| `npm run typecheck` | TypeScript check |
| `npm run db:export-sql` | Write the database migrations to `supabase/migrations/*.sql` |

Node.js 20+ is required (tested on Node 24).

---

## 2. Staff & roles

The owner adds staff in **Settings & staff**. Each person gets a username and password. Changing someone's role, disabling them or resetting their password signs them out on every device immediately.

| Role | Can do |
|---|---|
| **Owner** | Everything: settings, GST/tax, staff, profit reports, duplicate-invoice override |
| **Manager** | Orders, billing, returns/cancellations, stock adjustments, purchases, expenses, photos, sales reports (no tax settings or staff) |
| **Cashier** | POS billing (discount limit, 5% by default), own bills and receipts, product lookup |
| **Inventory staff** | Receive stock, purchases, invoice scans, Excel import, suppliers, product lookup |

Permissions are checked **on the server** for every API call; the menus only hide what you can't use.

---

## 3. Everyday how-to

### Make a bill (offline sale / POS) — `/admin/sales/new`
1. Search by name, brand, size, SKU, or **scan the barcode**. A USB/Bluetooth scanner works as a keyboard; the 📷 button uses the phone camera in Chrome on Android.
2. Tap products to add them, and use ± for quantity. Stock is shown on every tile.
3. Optional: customer mobile and name, and a discount (₹ or %, capped by your role).
4. Choose **Cash** (enter the cash received to see the change), **UPI** (tap "Show UPI QR" for the exact amount), **Card**, or **Split**.
5. **Complete sale.** The bill number is created, stock goes down once, and the payment and cashier are recorded.
6. **Print** (80 mm or A4, or "Save as PDF"), **WhatsApp** (opens a prefilled message with a signed receipt link; you press send), or **Share link**.

Double-tapping or retrying never makes two bills. Each bill carries a unique transaction id.

**No internet?** Bills can't be saved silently. The POS offers *"Save on this device (pending sync)"*. Those bills are clearly marked as **not in the system yet** and are sent automatically when the connection returns, still with no duplicates. If stock or prices changed in the meantime, the bill is flagged for a person to decide.

### Returns & cancellations — `/admin/sales` → open a bill
Managers and the owner can return some items (choose whether each goes back to stock) or cancel the whole bill. The original bill is never edited. A return document is created, stock goes back to the same batches, and the refund is recorded and logged.

### Receive stock — `/admin/inventory/stock-in` (fast, mobile)
1. Pick the supplier, or **+ New** (it warns you about similar names, so duplicates aren't created).
2. Enter the supplier invoice number. It is used to block receiving the same invoice twice.
3. Scan or search each product, then enter **qty** and **cost per unit**. GST %, batch and expiry are optional.
4. Item not in the shop yet? Use **+ New product**. It is created as a *hidden draft with photo pending*.
5. **Save draft** (no stock change) or **Preview & confirm**. Confirming adds stock exactly once, creates batches and updates the average cost.

### Excel / CSV import — `/admin/inventory/import`
1. Download the **Excel template**.
2. Upload the file. You get a preview only; stock does not change.
3. Rows are matched by SKU, then barcode, then a careful name match. A different size or flavour is **never** auto-matched; those rows show suggestions instead.
4. Fix rows inline, choose the right product, mark rows as **New**, or **Reject** them.
5. **Confirm import.** All rows go through in one transaction, or none do. Download the **error report** at any time. Import history is kept.

### Scan a supplier invoice (AI) — `/admin/purchases/import-invoice`
1. Upload the PDF or take a photo of the bill. It is stored **privately**.
2. **Read with AI** (Gemini or local Ollama, only if configured and the owner allowed it in Settings), or **Read text without AI (free)**, or type it in yourself.
3. The review screen shows the invoice next to the extracted lines. Low-confidence or missing values and arithmetic mismatches (qty × price ≠ amount, lines ≠ total) are highlighted. **Nothing is changed automatically.**
4. Match each line to the exact product, or mark it new, then correct anything wrong.
5. **Confirm & add to stock.** A duplicate invoice (same supplier + number) is blocked unless the owner gives a reason, which is logged.

### Approve product photos — `/admin/images`
1. Choose a product that needs a photo.
2. **Search for photos** (Open Food Facts, free, plus Google if configured), **paste an image link** from the brand or supplier site, or **upload** your own photo.
3. Each candidate shows its source, licence and a match score. Size or flavour mismatches are flagged in red.
4. **Approve** downloads the photo, resizes it to WebP, stores it and publishes it. Only approved photos ever appear on the website; otherwise a clean placeholder is shown.
5. An existing approved photo is **never replaced automatically**. "Find alternatives" only adds suggestions.

### Other pages
- **Inventory**: current stock, cost vs retail value, low stock, batches and expiry, the full movement history, adjustments with a reason, and CSV export.
- **Purchases / Suppliers**: history, supplier payments and amounts due, and products supplied.
- **Expenses**: rent, power, salaries and so on, with an optional receipt photo. Wrong entries are voided, never deleted.
- **Reports**: profit and sales, product-wise, online vs shop, payment methods, expenses, purchases and stock movements, all with CSV export.
- **Billing & GST**: business details on bills, bill numbering (`PXR/26-27/00001`, restarting every April), and the GST switch.
- **Activity log**: who did what and when (sales, returns, adjustments, price and tax changes, staff changes).

---

## 4. Money definitions (used everywhere)

- **Net sales** = bill value after discounts, **excluding GST**, plus delivery charges, minus returns.
- **COGS** = quantity sold × the purchase cost **frozen on each sale line** (weighted average at the time of sale). Later cost changes never alter past profit.
- **Gross profit** = net sales − COGS.
- **Estimated operating profit** = gross profit − **recorded** expenses. It is called "estimated" because only expenses entered in the app are counted.
- Stock purchases are **not** expenses. Unsold stock is shown at cost in Inventory and is never counted as profit.
- **Collections** = money actually received. Shop UPI and card are recorded by the cashier, *not* gateway-verified. COD is pending until it is marked paid.

The old opening stock has no recorded purchase cost. Reports show a warning until you set costs (Products → Edit) or receive new stock.

---

## 5. GST

GST is **OFF** by default. Bills are then plain receipts that say they are not tax invoices. To switch it on (owner, **Billing & GST**):
1. Enter your real GSTIN, legal name and state code. Formats are validated and nothing is ever filled in for you.
2. Set the **HSN code and GST rate** on each product. While GST is on, billing a product without a rate is refused, never guessed.
3. Choose whether prices include GST (normal for retail; online prices are always treated as inclusive).

Intra-state bills show CGST + SGST, and online orders to other states show IGST. Every tax-setting change is logged. Please confirm the rates and invoice format with your accountant.

---

## 6. Free AI & WhatsApp setup

| Feature | Free option | How |
|---|---|---|
| WhatsApp bill PDF | `wa.me` link with PDF download link | Built in. After a bill, type the customer's WhatsApp number and tap **Send**. WhatsApp opens with the message and a signed **PDF bill link**; press send. On a phone, **Share PDF** sends the actual PDF file (you pick the chat). |
| WhatsApp bill PDF, fully automatic | Meta WhatsApp Business Cloud API | Optional, with a small Meta fee per message. Set `WHATSAPP_CLOUD_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` and `WHATSAPP_BILL_TEMPLATE` (an approved template with a **Document** header and body variables {{1}} name, {{2}} bill no, {{3}} amount). Then **Send** delivers the PDF itself with no tap in WhatsApp. Needs your public https site URL. |
| Invoice reading (best) | **Google Gemini free tier** | Create a key at https://aistudio.google.com/apikey and set `GEMINI_API_KEY`. Then the **owner** ticks *"Allow sending supplier invoices to the external AI service"* in Settings. Note: on the free tier Google may use the data to improve its products. |
| Invoice reading (private) | **Ollama** on the shop PC | Install https://ollama.com, run `ollama pull qwen2.5vl`, then set `AI_BASE_URL=http://localhost:11434/v1` and `AI_MODEL=qwen2.5vl`. Invoices never leave the PC. |
| Invoice reading (no AI) | Built in | pdf.js reads text from PDFs and Tesseract OCR reads photos, both in the browser. Lower accuracy, so every value is marked for checking. |
| Photo search | **Open Food Facts** | Built in, no key. Optional: Google Programmable Search (100 free queries/day) via `GOOGLE_CSE_KEY` and `GOOGLE_CSE_CX`, limited to brand/supplier sites. |
| Photo double-check | Gemini (optional) | Settings → "Allow ask AI to double-check". Advisory only; a person still approves. |
| Online card/UPI gateway | — | Razorpay has per-transaction fees. **UPI QR + COD stay free and work without it.** |

API keys are only ever read on the server.

---

## 7. Environment variables

See `.env.example` for the full annotated list.

| Variable | Needed | Purpose |
|---|---|---|
| `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` | **always** | Owner login; signs login cookies and receipt links |
| `NEXT_PUBLIC_*` | recommended | Site URL, WhatsApp, UPI, contact, delivery charges (rebuild after changing) |
| `DATABASE_URL` | **Vercel / serverless** | Postgres connection string (Supabase free tier). Empty = local PGlite in `data/db` |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | **Vercel** | Supabase Storage for photos (public) and invoices/receipts (private) |
| `GEMINI_API_KEY` *or* `AI_BASE_URL`+`AI_MODEL` | optional | AI invoice reading |
| `GOOGLE_CSE_KEY`, `GOOGLE_CSE_CX` | optional | Google image search |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | optional | Online payment gateway |

---

## 8. Deployment

### A. Shop PC or any Node host with a disk (simplest, free)
```bash
npm install
npm run build
npm start            # keep it running (e.g. with pm2, or as a Windows service via nssm)
```
The data lives in `data/db` (database), `data/uploads` (approved photos) and `data/private` (invoices and receipts). **Back up the `data/` folder regularly.** Only one server process may use `data/db` at a time.

### B. Vercel + Supabase (free tiers)
1. Create a project at supabase.com (region: Mumbai).
2. **SQL Editor**: run `supabase/schema.sql`. It creates the photo bucket (public) and the invoice bucket (private). The app creates its tables automatically on first start; or run `supabase/migrations/*.sql` by hand.
3. **Project Settings → Database → Connection string → Transaction pooler** (port 6543): copy it to `DATABASE_URL`.
4. **Project Settings → API**: copy the URL to `SUPABASE_URL` and the `service_role` key to `SUPABASE_SERVICE_ROLE_KEY` (server only).
5. **Check the settings before deploying:** put the same values in `.env.local` temporarily and run `npm run check-env -- --vercel --connect`. It checks that the Supabase URL and keys are the right ones (not the public anon/publishable key, same project as the database), that the database password works, and that the storage buckets exist. Vercel runs this check automatically (`vercel-build` script), so a deployment with wrong values fails with a clear message. Emergency bypass: `SKIP_ENV_CHECK=1`.
6. Push to a **private** GitHub repo and import it in Vercel. Git must be installed: https://git-scm.com/download/win. Add all the variables, using a new strong `ADMIN_PASSWORD` and a 64-character `ADMIN_SESSION_SECRET`, then deploy.
6. Optional Razorpay: add the keys, then in Razorpay Dashboard → Webhooks add `https://<your-domain>/api/payments/razorpay/webhook` with the events `payment.captured`, `payment.failed` and `order.paid`, and set the secret as `RAZORPAY_WEBHOOK_SECRET`.

Row Level Security is switched on for every table with no public policies. The browser can never read the database directly, and the server connects with the database owner role.

---

## 9. Architecture notes

```
src/lib/db/          adapter (PGlite | pg), migrations, seed (first-run import)
src/lib/server/      business logic: inventory engine, sales/POS, returns, orders, purchases,
                     suppliers, stock-import, invoices (+ AI extract), images, reports, staff, audit
src/lib/permissions  roles → permissions (shared by server & UI)
src/lib/tax.ts       bill & GST calculator (integer paise)
src/app/api/admin/*  staff APIs (every route checks a permission)
src/app/admin/*      admin pages        src/app/(store)/*  storefront        src/app/r/[id]  customer receipt
tests/               vitest suites (in-memory Postgres)
```

How stock integrity is guaranteed:
- **Atomic stock change:** every change is one conditional `UPDATE … WHERE stock + change >= 0` inside a transaction, so two tills can't sell the last unit twice.
- **Duplicate guard in the database:** each change writes an `inventory_movements` row, and a **unique index** on (transaction, line, batch, type) makes a duplicate deduction impossible.
- **Idempotent operations:** POS bills (`client_txn_id`), online orders (`client_key`), purchase confirmation (draft → confirmed in one statement), imports and gateway payments are all safe to repeat.
- **Append-only history:** movements and audit logs are protected by database triggers. Returns and cancellations are new rows, never edits.

---

## 10. Known limitations

- **Offline POS:** works while the page stays open. Reloading the page with no internet won't load it (no service worker). Offline bills are clearly labelled as pending until they sync.
- **PGlite is single-process:** run one `npm start` per `data/db`. Use `DATABASE_URL` (Postgres) for several servers or for Vercel.
- **Opening stock has no purchase cost:** profit for those units is overstated until costs are set; reports show this warning.
- **AI and OCR quality depends on the invoice:** every extracted value must be reviewed before confirming, by design.
- **Live updates use polling:** the dashboard refreshes every 20 s and on focus, the POS catalogue every 2 min, and product pages check live stock on load. It is not WebSocket push.
- The cloud-Postgres path (`DATABASE_URL`) is tested over the real Postgres wire protocol (`tests/postgres-adapter.test.ts`), but not yet against a live Supabase project — do one test bill after deploying.
