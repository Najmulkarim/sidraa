# Deploying

Production = **Vercel Pro** (the app) + **Supabase Pro** (database, auth,
storage). Prices checked 23 Oct 2026: Vercel Pro $20 per developer seat per
month (Hobby is for non-commercial use only); Supabase Pro from $25 per month
(Free projects pause after a week without activity and have no automatic
backups). Choose the Supabase region closest to Bangladesh (Mumbai, else
Singapore) and the same region for Vercel functions.

## 1. Supabase

1. Create a project (Pro plan, Mumbai/Singapore). Save the database password.
2. Install the CLI and link: `npx supabase login`, `npx supabase link --project-ref <ref>`.
3. Push the schema: `npx supabase db push` (runs `supabase/migrations/0001…0011`).
4. Optional demo data: run `supabase/seed.sql` in the SQL editor. **Skip this
   for a real launch**, or delete the demo products afterwards.
5. Turn off public sign-ups and create your super admin account: `docs/first-admin.md`.
6. Authentication → URL Configuration: set **Site URL** to your shop address.
7. Project Settings → API Keys: copy the **publishable** key and a **secret** key.

## 2. Vercel

1. Push this folder to a private GitHub repository and import it in Vercel.
2. Environment variables (Production and Preview):

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable key |
   | `SUPABASE_SECRET_KEY` | secret key — **never** with a `NEXT_PUBLIC_` prefix |
   | `RATE_LIMIT_SALT` | output of `openssl rand -hex 32` |
   | `NEXT_PUBLIC_SITE_URL` | `https://your-domain.com` |
   | `CRON_SECRET` | output of `openssl rand -hex 32` (protects the courier status job) |

3. Function region: Project → Settings → Functions → choose Mumbai (`bom1`) or Singapore (`sin1`).
4. Deploy, then add your domain under Settings → Domains.

## 3. Courier (Steadfast / Pathao)

Admin → **Settings → Courier** (super admin):

- **Steadfast**: API key + secret key from the Steadfast merchant panel → *Test connection* shows your balance.
  For instant status updates, click *Generate* next to **Webhook token**, save, then in Steadfast's
  webhook settings enter the **Steadfast webhook URL** shown on the page and the same token as the Bearer token.
- **Pathao**: client ID, client secret, merchant login email and password, and the store ID. Keep
  *Sandbox* ticked until a test parcel works, then untick it. For webhooks, add the **Pathao webhook URL**
  in the Pathao merchant panel with the secret you generated, and paste the *integration secret* Pathao
  shows back into Settings.
- **Safety net**: `vercel.json` runs `/api/cron/courier-sync` every 30 minutes (needs `CRON_SECRET`;
  Vercel Hobby only allows daily crons — on Hobby, call the URL from any external scheduler with the
  header `Authorization: Bearer <CRON_SECRET>`). It asks the courier about parcels not updated for 30 minutes.

Book parcels from **Orders**: *Send* on a row (or select rows → *Send*). The amount to collect is the
order total minus any advance, read from the database. A "delivered" courier status marks the order
Delivered (cash collected); cancelled/returned statuses mark it Returned and put the stock back.

## 4. Facebook

Admin → **Settings → Facebook & tracking** (super admin, or a role with the *marketing* permission):

- **Pixel ID** — turns on the browser Pixel: PageView, ViewContent, AddToCart, InitiateCheckout, Purchase.
- **Conversions API** — tick it and paste an access token (Events Manager → Settings → Conversions API).
  Every order also sends a server-side Purchase with hashed phone/name/district, IP and browser, and the
  `_fbp`/`_fbc` cookies. The browser and server events share the order reference as the event ID, so Meta
  counts each order once. Use *Test event code* first, then clear it. The last events are listed on the page.
- **Catalog** — add `https://your-domain.com/feeds/facebook-catalog.csv` as a scheduled data feed in
  Commerce Manager. Product IDs match the Pixel's `content_ids`.

## 5. Before taking real orders

- [ ] Real delivery charges and areas in Admin → Settings
- [ ] Contact phone/email, COD terms and return window in Settings
- [ ] Logo uploaded (optional — the name is shown otherwise)
- [ ] Demo products removed or archived; real products published with photos
- [ ] Policy pages (`/info/*`) reviewed — they are plain starter templates
- [ ] Super admin account has two-factor turned on; staff added in Settings → Staff & roles
- [ ] Courier keys tested; one sandbox (or real) parcel booked and its status updated
- [ ] Pixel ID set; a test order shows in Events Manager → Test events (then clear the test code)
- [ ] Place one real test order on the live site, then cancel it in admin and check the stock came back
- [ ] Supabase → Database → Backups shows daily backups (Pro)

## Staging

Use a second, free Supabase project with Vercel **Preview** deployments for
trying changes. Never point preview deployments at the production database.

## Optional: privacy clean-up job

`public.redact_old_orders(days)` blanks names, addresses and notes on
finished orders older than `days` (minimum 30). Schedule it with Supabase
Cron (Integrations → Cron), for example monthly:

```sql
select cron.schedule('redact-old-orders', '0 3 1 * *', $$ select public.redact_old_orders(365) $$);
```
