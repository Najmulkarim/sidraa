import 'server-only';
import type { createAdminClient } from '@/lib/supabase/admin';

/**
 * The customer finished the order: their incomplete order (this checkout's, and any
 * other open one with the same number from the last two days) is removed, so the
 * list only ever shows checkouts that were left without ordering.
 */
export async function closeIncompleteOrders(admin: ReturnType<typeof createAdminClient>, { key, phone }: { key: string | null; phone: string | null; orderId: string }) {
  const since = new Date(Date.now() - 2 * 24 * 3600_000).toISOString();
  const jobs = [];
  if (key) jobs.push(admin.from('incomplete_orders').delete().eq('draft_key', key).neq('status', 'cancelled'));
  if (phone) jobs.push(admin.from('incomplete_orders').delete().eq('customer_phone', phone).eq('status', 'open').gte('updated_at', since));
  const results = await Promise.all(jobs);
  for (const r of results) if (r.error) console.error('[incomplete] close', r.error.message);
}
