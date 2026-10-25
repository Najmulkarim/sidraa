'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth';
import { refreshCatalog } from '@/lib/facebook/catalog';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ActionState } from '@/lib/types';

/** "Refresh catalog now" — after listing new products. */
export async function refreshCatalogNow(): Promise<ActionState> {
  await requirePermission('marketing');
  const r = await refreshCatalog();
  revalidatePath('/admin/settings');
  return { ok: r.ok, message: r.message };
}

/** Feed ID and token for sending the catalog to Facebook at once (token: empty keeps the saved one). */
export async function saveCatalogSettings(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requirePermission('marketing');
  const feedId = String(fd.get('catalogFeedId') ?? '').trim();
  const token = String(fd.get('catalogToken') ?? '').trim();
  if (feedId && !/^\d{5,30}$/.test(feedId)) return { ok: false, message: 'The feed ID is a long number from Commerce Manager → Data sources.', fieldErrors: { catalogFeedId: 'Numbers only' } };
  if (!z.string().max(600).safeParse(token).success) return { ok: false, message: 'Token is too long.' };
  const patch: Record<string, string | null> = { catalog_feed_id: feedId || null };
  if (fd.get('clear_catalogToken') === 'on') patch.catalog_token = null;
  else if (token) patch.catalog_token = token;
  const { error } = await createAdminClient().from('marketing_settings').update(patch).eq('id', 1);
  if (error) return { ok: false, message: 'Could not save. Run the latest database update (0022) in Supabase, then try again.' };
  revalidatePath('/admin/settings');
  return { ok: true, message: 'Saved.' };
}
