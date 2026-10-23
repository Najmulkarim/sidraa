# COD Store — Next.js + Supabase

A cash-on-delivery shop for Bangladesh: storefront, cart, checkout without an
account, coupons, order tracking, and an admin panel for orders (full edit,
manual phone/Facebook orders), Steadfast/Pathao courier booking with status
sync, customers and block list, products, stock, reports, Facebook Pixel +
Conversions API, and settings with Super admin / Manager / Support roles. Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 ·
Supabase (Postgres, Auth, Storage) · Zod 4.

> **বাংলায় সংক্ষেপে:** এটা নতুন Next.js + Supabase ভার্সন। দাম, স্টক আর অর্ডার
> সবকিছু ডাটাবেসের ভেতরে একটাই ট্রানজ্যাকশনে হিসাব হয় — ব্রাউজার থেকে দাম পাঠালে
> সেটা মানা হয় না, একই অর্ডার দুইবার হয় না, শেষ পিসটা দুইজন একসাথে কিনতে পারে না।
> চালাতে নিচের "Run it locally" অংশটা দেখুন; লাইভ করতে `docs/deployment.md`;
> প্রথম অ্যাডমিন বানাতে `docs/first-admin.md`।

## Run it locally

Needs Node.js 20.9+ and Docker (for the local Supabase stack).

```bash
npm install
npx supabase init            # creates supabase/config.toml; keep the existing migrations
npx supabase start           # local Postgres, Auth, Storage
npx supabase db reset        # runs migrations 0001–0009 + seed.sql
cp .env.example .env.local   # fill from `npx supabase status`:
                             #   API URL → NEXT_PUBLIC_SUPABASE_URL
                             #   Publishable/anon key → NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
                             #   Secret/service_role key → SUPABASE_SECRET_KEY
                             #   RATE_LIMIT_SALT → openssl rand -hex 32
npm run dev                  # http://localhost:3000
```

Then create your admin account (local Studio at http://127.0.0.1:54323):
follow `docs/first-admin.md`, and sign in at `/admin/login`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | unit tests (validation, cart, money/dates, CSV, status workflow, DB error mapping) |
| `npm run test:db` | pgTAP database tests (`supabase test db`) — RLS, pricing, duplicates, stock, MFA |
| `npm run test:integration` | supabase-js against the local stack — price tampering, parallel duplicates, stock race, API access |
| `npm run test:e2e` | Playwright — checkout, tracking, admin flows (desktop + mobile) |
| `npm run db:types` | generate exact DB types into `src/lib/database.types.ts` |

## How it fits together

```
Browser ──► Next.js (Server Components, Server Actions, src/proxy.ts)
              │  catalogue: cookieless publishable-key client → RLS shows published data only
              │  admin:     admin's own session cookie      → RLS + is_admin()
              │  checkout:  secret key, server-only file    → place_order() only
              ▼
           Supabase Postgres (RLS on every table) · Auth (+ TOTP) · Storage (product-images)
```

- **Checkout** (`src/actions/shop.ts → placeOrder`): Zod → rate limits → `place_order()`.
  That one SQL function locks the variant rows, re-prices every line from the
  database, checks stock, writes the order, items, stock movements and history,
  and returns a random reference like `SD-7K2M-9QXA`.
- **Status changes** go through `set_order_status()`: forward moves, cancel while
  open, return after shipping; cancelled/returned put stock back exactly once.
- **Stock** never changes by direct update: orders, cancels, returns and the
  admin's Restock/Adjust all write `inventory_movements`.
- **Revenue** counts delivered orders on their delivery day (Asia/Dhaka).
- **Caching**: storefront pages are statically cached for 5 minutes; every admin
  save calls `revalidatePath('/', 'layout')`, and each order refreshes the
  pages of the products it touched.

Details: `docs/security.md`.

## Project structure

```
supabase/
  migrations/0001…0011   schema, RLS, storage, functions, reports, order operations,
                         roles, order editing, coupons, block list, courier, Facebook
  seed.sql               demo catalogue (27 products, 7 categories), 3 placeholder delivery zones
  tests/database/        pgTAP
public/brand, public/demo   your logo and the demo product illustrations
src/
  proxy.ts               /admin session refresh + redirect (Next 16 "proxy")
  actions/               Server Actions (shop, auth, admin-*)
  app/(shop)/            home, products, category, product, cart, checkout, order, track, info
  app/admin/             login (+ two-factor), dashboard, orders, products, categories,
                         inventory, reports, settings, account, CSV exports
  components/shop|admin/
  lib/                   validation (Zod), catalog queries, auth, rate limit, formatting, Supabase clients
tests/unit|integration|e2e/
docs/                    deployment, first admin, security
```

## Decisions taken (Stage 1 open questions)

1. **Brand & design** — the original Sidraa look: your logo (`public/brand/`), magenta-to-plum
   gradients, Poppins and Playfair Display, illustrated demo products (`public/demo/`), dark
   footer and dark admin sidebar. Colours come from Admin → Settings, so a new brand colour
   carries through. No contact details are invented: fill phone, email and social links in Settings.
   Home-page offers are only things the shop really does (COD, free-delivery threshold, return
   window); the "up to N% off" badge is calculated from real product prices.
2. **Delivery zones** — Inside Dhaka ৳70, Dhaka suburbs ৳100 (both free over
   ৳3,000), Outside Dhaka ৳130. These are placeholders; set your courier's real rates.
3. **Roles** — Super admin, Manager, Support, as in the older Sidraa app. Super
   admins edit what Manager and Support may do (Settings → Staff & roles); the
   database enforces it. See `docs/first-admin.md`.
4. **Scope** — added after Stage 1 on request: full order editing and manual
   orders, coupons, block list, customers, Steadfast/Pathao booking + webhooks +
   cron sync, Facebook Pixel + Conversions API + catalog feed, tabbed global
   settings. Still **not** included: purchase orders and profit & loss from the
   older app, online payment.
5. **Tracking** — reference + last 4 phone digits (kept as designed): the
   reference itself is unguessable, attempts are rate-limited, and the result
   never includes name, phone or address.

## Status checklist

✅ = written **and** executed here. 🟡 = written, verified only partly (see
"What was and was not run"). Nothing is marked done that is not in the code.

**Stage 2 — database**
- ✅ Migrations 0001–0009: 12 tables, enums, constraints, indexes, triggers
- ✅ RLS on every table; column-level grant keeps stock out of direct updates
- ✅ `place_order` (locks, server pricing, free-delivery threshold, idempotency, random refs, movements, history)
- ✅ `set_order_status`, `adjust_stock`, `track_order`, `quote_order`, `hit_rate_limit`
- ✅ Two-factor enforced in `is_admin()` / `is_owner()` once a TOTP factor is verified
- ✅ Reports: `report_summary`, `report_products`, `dashboard_stats`; `redact_old_orders`
- ✅ Storage bucket + admin-only write policies (bucket SQL executed against a stub of Supabase's storage schema)
- ✅ Seed data
- ✅ 195 pgTAP assertions in 9 files — all pass

**Stage 3 — storefront**
- 🟡 Layout, header (no-JS mobile menu), footer, home, all products (search / category / sort / in-stock / pagination), category, product (gallery, size picker with stock, JSON-LD), info pages, 404, error page

**Stage 4 — cart, checkout, tracking**
- 🟡 Cart in localStorage (ids + quantities only), server quote, sold-out / low-stock handling
- 🟡 Checkout Server Action, rate limits, idempotency key, values kept on error, confirmation page visible only to the ordering browser
- 🟡 Tracking page

**Stage 5 — admin**
- 🟡 Login with rate limit, two-factor verify + enrolment, sign-out, three-layer access checks
- 🟡 Dashboard, orders (search / filter / date range / pagination), order detail with history and status changes, printable packing slip
- 🟡 Products with variants, opening stock, photo upload / reorder / alt text / delete, archive, owner-only delete
- 🟡 Categories, inventory with movement log and Restock/Adjust, reports with daily chart and CSV, settings with logo and delivery zones

**Orders page (0010)**
- ✅ Statuses New, Confirmed, Ready to deliver, In courier, Hold, Ship later, Delivered, Cancelled, Returned, Lost, Fake + soft delete/restore; fake/cancel/return put stock back, lost does not; delivered marks the COD amount paid
- ✅ Paid amount (advance), order notes and logs, staff assignment, bulk status change, tab counts, per-customer delivery success rate — 32 more pgTAP checks
- 🟡 Admin Orders page: search, employee filter, date range, status tabs with counts, detailed rows (customer %, WhatsApp, thumbnails, paid/due, inline status, notes, employee, fake/edit/hold/delete), bulk actions, multi-slip printing, rows-per-page

**Live-shop features (0011)**
- ✅ Roles Super admin / Manager / Support with an editable permission matrix; `has_permission()` in every policy and function; dashboard hides money without *revenue*
- ✅ `admin_save_order`: full edit (items, sizes, quantities, custom prices, area, delivery charge, discount, customer, source) with per-variant stock difference + movements; manual orders with idempotency
- ✅ Coupons (percent / fixed, minimum, cap, dates, usage limit under a row lock), blocked numbers refused at checkout, customers list
- ✅ Courier: secret settings (masked), double-booking guard, booking record → In courier, courier status → Delivered/Returned (stock back), sync queue
- ✅ Conversions API settings (masked token) and event log — 59 pgTAP checks for all of the above
- 🟡 App: order editor dialog + pages, New order, Send to courier (single, bulk, Pathao city/zone), Check now, courier column, Customers, Coupons, tabbed Settings (Store, Delivery, Courier, Facebook & tracking, Staff & roles), permission-aware menu
- 🟡 Steadfast/Pathao HTTP clients, webhooks (`/api/webhooks/steadfast|pathao`), cron (`/api/cron/courier-sync`, `vercel.json`) — written to the couriers' documented APIs; not run against live accounts
- 🟡 Facebook Pixel events, server-side Purchase via `after()` with SHA-256 hashed user data, catalog feed `/feeds/facebook-catalog.csv`, CSP updated — not run against Meta

**Variations**
- ✅ Up to three variation types per product (Colour, Size and one you name, e.g. Sleeve); each combination has its own SKU, price, stock and photo; the photo must be one of the product's photos (trigger) and is cleared if that photo is deleted — 8 pgTAP checks
- 🟡 Shop: one picker per type, colour swatches show the colour's photo and switch the gallery, sold-out combinations struck through; cart/orders/slips show "Navy / XL / Half sleeve" with the variation photo
- 🟡 Admin: photos can be uploaded on the New product page itself (before the first save; drag & drop upload, drag photos to reorder with mouse or finger, alt text), name the three types, "Create combinations" from comma-separated values, pick a photo per row (or for every row of that colour)

**Stage 6 — SEO, reports, tests, docs**
- 🟡 Metadata per page, canonical URLs, Open Graph, `sitemap.xml`, `robots.txt`, JSON-LD
- ✅ Unit tests (59) · 🟡 integration tests (written, not run) · 🟡 Playwright E2E (written, not run)
- ✅ README, `docs/deployment.md`, `docs/first-admin.md`, `docs/security.md`

## What was and was not run before delivery

The build sandbox could not reach the npm registry, so `npm install`,
`next build`, `tsc` against the real Next.js/React/Supabase types, Vitest,
Playwright and the Supabase CLI **were not run**. What *was* run:

- **Database**: all migrations + seed on PostgreSQL 16 with a stub of
  Supabase's `auth`/`storage` schemas and roles; the 195 pgTAP assertions pass;
  a 20-buyer race for 2 units produced exactly 2 orders and stock 0; 15 parallel
  submissions with one key produced 1 order and took stock once.
- **TypeScript**: `tsc --strict` on all `src/lib` logic with Zod's v4 API — clean;
  all app files type-checked against stubbed external modules (no errors between
  project files); every file parses.
- **Unit tests**: 59/59 pass (run through a Vitest-compatible runner).
- **Preview**: the real pages bundled for the browser with a mock database; 105 click-through checks
  pass, including colour/size/sleeve picking with variation photos, full order edit, manual order, simulated courier booking/sync, coupons, block list,
  settings tabs and "view as Support" permission checks.
- **Rendering**: every page (12 storefront, 13 admin) server-rendered with the
  real components, React 19 and the real Tailwind 4 build, against seed-shaped
  data, and screenshotted on desktop and mobile.
- **Browser**: the real cart and checkout components hydrated in Chromium with a
  mocked server: 14/14 checks (server pricing, zone re-quote, tampered prices not
  sent, idempotency key reuse, values kept after errors, stock errors, sold-out lines).

So on first install expect to run `npm run typecheck` and fix any small type
mismatches against the real library types — the logic, SQL and markup are tested,
the exact library typings are not.
