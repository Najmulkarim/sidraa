'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth';
import { refreshCatalog } from '@/lib/facebook/catalog';
import type { ActionState } from '@/lib/types';

/** "Refresh catalog now" — after listing new products. */
export async function refreshCatalogNow(): Promise<ActionState> {
  await requirePermission('marketing');
  const r = await refreshCatalog();
  revalidatePath('/admin/settings');
  return { ok: r.ok, message: r.message };
}
