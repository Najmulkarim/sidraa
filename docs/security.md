# Security model

## Where each rule is enforced

| Rule | Browser | Server (Next.js) | Database |
|---|---|---|---|
| Prices and totals | shows server quote only | never reads client prices | `place_order()` prices every line from `product_variants` / `products` |
| No overselling | stock labels are hints | — | rows locked `FOR UPDATE` in id order; `check (stock >= 0)` backstop |
| No duplicate orders | one idempotency key per checkout attempt | retry with the same key skips rate limits | advisory lock + unique `idempotency_key` |
| Valid input | form hints | Zod on every Server Action | same checks inside the SQL functions + table `check`s |
| Admin only | — | `proxy.ts` redirect, `requireAdmin()` in every page/action/route | RLS + `is_admin()` (with two-factor once enrolled) |
| Permissions (Super admin / Manager / Support) | links hidden | `requirePermission()` in every page/action | `has_permission()` in RLS policies; `require_permission()` at the top of every function |
| Staff & roles | super admins only | `requireSuperAdmin()` | `staff_list`, `save_staff`, `set_role_permissions` check `is_owner()` (super admin); nobody can demote themselves |
| Courier keys, Conversions API token | never sent; masked `••••1234` | read with the service role only after the database confirmed the permission | tables with RLS and **no** grants for `anon`/`authenticated` |
| Courier booking | — | `begin_courier_send()` (as the staff member) returns the parcel from the database | 2-minute claim + unique consignment index → no double booking |
| Courier webhooks / cron | — | token / signature / `CRON_SECRET`, compared in constant time | `apply_courier_status()` callable by the service role only |
| Coupons | code only | Zod | `coupon_discount()` + row lock in `place_order()`; usage limit holds under concurrency |
| Blocked numbers | — | — | `place_order()` refuses them |
| Rate limits | — | checkout 5/10 min per IP + 3/hour per phone; tracking 10/10 min per IP; login 5/15 min per IP + 10/hour per email | `hit_rate_limit()` table, hashed keys |

## Keys

- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is public by design; RLS protects data.
- `SUPABASE_SECRET_KEY` bypasses RLS. It is read only in
  `src/lib/supabase/admin.ts`, which begins with `import 'server-only'` —
  importing it from a client component fails the build. It is used for
  `place_order`, `track_order`, `hit_rate_limit`, the just-placed order
  confirmation, reading courier/Conversions API secrets (after a permission
  check), the courier webhook/cron writes, and creating staff logins (after
  the database confirmed a super admin).
- `CRON_SECRET` protects `/api/cron/courier-sync`.
- Courier keys and the Conversions API token are **not** environment variables:
  they live in `courier_settings` / `marketing_settings`, which have RLS on and
  no grants for browser roles. Admins see only the last 4 characters.
- `RATE_LIMIT_SALT` makes the stored IP/phone hashes useless outside your database.

## Functions callable by role

| Function | anon | authenticated | service role |
|---|---|---|---|
| `quote_order` | ✓ | ✓ | ✓ |
| `place_order`, `track_order`, `hit_rate_limit`, `redact_old_orders` | — | — | ✓ |
| `set_order_status`, `adjust_stock`, order operations, `admin_save_order` | — | ✓ (each checks its permission) | ✓ |
| `report_summary`, `report_products` (revenue), `dashboard_stats` (money only with revenue) | — | ✓ (permission) | ✓ |
| courier: `begin_courier_send`, `record_courier_booking`, `fail_courier_send`, `courier_options` | — | ✓ (courier) | ✓ |
| `get/save_courier_settings`, `get/save_marketing_settings` | — | ✓ (courier_settings / marketing) | ✓ |
| `apply_courier_status`, `courier_sync_queue` | — | — | ✓ |
| `apply_order_status` (status engine) | — | — | — (internal only) |

All `security definer` functions pin `search_path = ''` (tested).

## Order references and privacy

- References are 8 random Crockford base32 characters (≈1.1 trillion values),
  not a counter, so they reveal nothing about volume and cannot be guessed.
- The confirmation page shows full details only to the browser that placed
  the order (httpOnly cookie). Tracking needs the reference **and** the last
  4 phone digits, is rate-limited, gives one message for any mismatch, and
  never returns name, phone or address.
- Customer IPs are stored only as salted hashes (`orders.ip_hash`).

## Headers

Set in `next.config.ts`: Content-Security-Policy, `X-Frame-Options: DENY`,
`X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`,
HSTS in production. Admin responses get `Cache-Control: private, no-store`
and `X-Robots-Tag: noindex`.

The CSP allows `'unsafe-inline'` scripts because Next.js injects inline
hydration scripts. To remove it, move to a nonce-based CSP generated in
`src/proxy.ts` (see the Next.js "Content Security Policy" guide); note that
nonces make every page dynamic, which turns off static caching.

## CSRF

Server Actions compare the `Origin` header with the host (built into
Next.js). Route handlers: the two CSV exports (read-only `GET`s behind the
admin session and a permission), the public catalog feed (published products
only), the two courier webhooks (shared secret) and the cron job (`CRON_SECRET`).

## CSV exports

Every cell is quoted and cells starting with `= + - @` are prefixed with `'`
so a customer named `=HYPERLINK(...)` cannot run anything in Excel.

## Known limits

- `orders_export` is checked by the app (the CSV route); a role that can read
  orders could in principle read the same rows through the API with its own
  session. Treat "orders" as "can see order data".
- Courier webhook payload formats come from the couriers' published docs and
  community libraries, not from a live account; the cron job re-checks every
  parcel, so a missed or unrecognised webhook only delays an update.

- Rate limits are per IP; customers behind one carrier NAT share a bucket.
  The limits are set generously for that reason.
- Supabase Auth's own sign-in endpoint is also reachable directly with the
  publishable key; Supabase applies its own rate limits there, and an account
  is useless without an `admin_profiles` row (and the code, once two-factor is on).
