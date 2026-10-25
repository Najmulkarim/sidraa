import 'server-only';
import { revalidatePath } from 'next/cache';
import { SITE_URL } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';

export const FEED_PATH = '/feeds/facebook-catalog.csv';

type Row = { catalog_feed_id: string | null; catalog_token: string | null; graph_version: string };

/**
 * Rebuilds the product feed now and, when a feed ID and token are saved,
 * asks Facebook to fetch it straight away (Graph API: POST /{feed-id}/uploads).
 * Used by the "Refresh catalog" button and the daily job. Never throws.
 */
export async function refreshCatalog(): Promise<{ ok: boolean; message: string }> {
  revalidatePath(FEED_PATH);
  const admin = createAdminClient();
  const { data: m } = await admin.from('marketing_settings').select('catalog_feed_id, catalog_token, graph_version').eq('id', 1).maybeSingle<Row>();
  if (!m?.catalog_feed_id || !m.catalog_token) {
    return { ok: true, message: 'Catalog file refreshed. Facebook picks it up at its next scheduled fetch (add the feed ID and token to send it at once).' };
  }

  let ok = false;
  let message: string;
  try {
    const url = `https://graph.facebook.com/${m.graph_version}/${m.catalog_feed_id}/uploads`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ url: `${SITE_URL}${FEED_PATH}`, access_token: m.catalog_token }),
      signal: AbortSignal.timeout(20_000),
      cache: 'no-store',
    });
    const body = (await res.json().catch(() => null)) as { id?: string; error?: { message?: string } } | null;
    ok = res.ok && !!body?.id;
    message = ok ? 'Sent to Facebook — the catalog updates in a few minutes.' : `Facebook said: ${body?.error?.message ?? `HTTP ${res.status}`}`;
  } catch {
    message = 'Could not reach Facebook. The catalog file is refreshed; try again later.';
  }
  await admin.from('marketing_settings').update({ catalog_pushed_at: new Date().toISOString(), catalog_push_result: message.slice(0, 500) }).eq('id', 1);
  return { ok, message };
}
