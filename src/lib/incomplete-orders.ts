import 'server-only';
import type { createAdminClient } from '@/lib/supabase/admin';

/**
 * An order was placed: its checkout's incomplete order, and any other open one with
 * the same number from the last two days, become "converted" and point at the order.
 */
export async function closeIncompleteOrders(admin: ReturnType<typeof createAdminClient>, { key, phone, orderId }: { key: string | null; phone: string | null; orderId: string }) {
  const since = new Date(Date.now() - 2 * 24 * 3600_000).toISOString();
  const done = { status: 'converted', order_id: orderId, updated_at: new Date().toISOString() };
  const jobs = [];
  if (key) jobs.push(admin.from('incomplete_orders').update(done).eq('draft_key', key).eq('status', 'open'));
  if (phone) jobs.push(admin.from('incomplete_orders').update(done).eq('customer_phone', phone).eq('status', 'open').gte('updated_at', since));
  const results = await Promise.all(jobs);
  for (const r of results) if (r.error) console.error('[incomplete] close', r.error.message);
}
