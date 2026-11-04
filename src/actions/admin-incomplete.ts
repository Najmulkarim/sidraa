'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth';
import type { ActionState } from '@/lib/types';

function refresh() {
  revalidatePath('/admin/incomplete');
  revalidatePath('/admin', 'layout');
}

/** Cancel an incomplete order (kept, out of the open list), or open it again. */
export async function setIncompleteStatus(id: string, status: 'open' | 'cancelled'): Promise<ActionState> {
  const { supabase } = await requirePermission('orders');
  if (!z.uuid().safeParse(id).success || !['open', 'cancelled'].includes(status)) return { ok: false, message: 'Not found.' };
  const { error } = await supabase.from('incomplete_orders').update({ status, updated_at: new Date().toISOString() }).eq('id', id).neq('status', 'converted');
  if (error) return { ok: false, message: 'Could not save. Please try again.' };
  refresh();
  return { ok: true, message: status === 'cancelled' ? 'Incomplete order cancelled.' : 'Moved back to open.' };
}

export async function deleteIncomplete(id: string): Promise<ActionState> {
  const { supabase } = await requirePermission('orders');
  if (!z.uuid().safeParse(id).success) return { ok: false, message: 'Not found.' };
  const { error, count } = await supabase.from('incomplete_orders').delete({ count: 'exact' }).eq('id', id);
  if (error || !count) return { ok: false, message: 'Could not delete. Please try again.' };
  refresh();
  return { ok: true, message: 'Incomplete order deleted.' };
}

/** After staff made an order from it in the order editor. */
export async function markIncompleteConverted(id: string, orderId: string): Promise<ActionState> {
  const { supabase } = await requirePermission('orders_edit');
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(orderId).success) return { ok: false };
  const { error } = await supabase.from('incomplete_orders').update({ status: 'converted', order_id: orderId, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return { ok: false, message: 'The order was made, but the incomplete order was not marked as done.' };
  refresh();
  return { ok: true };
}
