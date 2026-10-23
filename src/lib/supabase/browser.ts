'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/lib/env';

/**
 * Browser client, used only inside the admin panel for two things that
 * must run in the browser: uploading images straight to Storage (the
 * bucket policy checks is_admin()) and two-factor enrolment.
 */
let client: SupabaseClient | undefined;

export function getBrowserClient() {
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  return client;
}
