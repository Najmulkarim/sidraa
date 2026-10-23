import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from '@/lib/env';

/**
 * Service-role client. The ONLY file that reads SUPABASE_SECRET_KEY.
 * `import 'server-only'` makes any client-component import fail the build.
 *
 * Used for:
 *   - place_order(), track_order(), hit_rate_limit() (shop Server Actions)
 *   - reading the just-placed order for the confirmation page
 *   - courier keys / Conversions API token (src/lib/courier/config.ts,
 *     src/lib/facebook/capi.ts) — only after the caller's permission was
 *     checked in the database, or from an authenticated webhook / cron
 *   - apply_courier_status() and courier_sync_queue() (webhooks, cron)
 *   - creating staff logins in Supabase Auth (after is_owner() is checked)
 */
let admin: SupabaseClient | undefined;

export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error('Missing SUPABASE_SECRET_KEY (server environment only).');
  admin ??= createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return admin;
}
