'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth';
import { normalizeBdPhone } from '@/lib/phone';
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

const text = (max: number) => z.string().trim().max(max).transform((v) => v || null);
const editSchema = z.object({
  customerName: text(120),
  customerPhone: z.string().max(20),
  address: text(500),
  area: text(80),
  district: text(80),
  note: text(500),
  zoneId: z.union([z.uuid(), z.literal('')]).transform((v) => v || null),
  items: z.array(z.object({ variant_id: z.uuid(), quantity: z.number().int().min(1).max(20) })).max(30),
});

/** Staff fix what the customer typed (address, products …) before calling or making the order. */
export async function saveIncomplete(id: string, input: unknown): Promise<ActionState> {
  const { supabase } = await requirePermission('orders');
  if (!z.uuid().safeParse(id).success) return { ok: false, message: 'Not found.' };
  const parsed = editSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'Please check the details.' };
  const d = parsed.data;
  const phone = normalizeBdPhone(d.customerPhone);
  if (!phone) return { ok: false, message: 'Enter a valid mobile number (01XXXXXXXXX).' };
  // Same product twice → one line with both quantities.
  const items = new Map<string, number>();
  for (const l of d.items) items.set(l.variant_id, Math.min(20, (items.get(l.variant_id) ?? 0) + l.quantity));
  const { error, count } = await supabase
    .from('incomplete_orders')
    .update({
      customer_name: d.customerName, customer_phone: phone, address: d.address, area: d.area, district: d.district, note: d.note, zone_id: d.zoneId,
      items: [...items].map(([variant_id, quantity]) => ({ variant_id, quantity })),
      updated_at: new Date().toISOString(),
    }, { count: 'exact' })
    .eq('id', id)
    .neq('status', 'converted');
  if (error || !count) return { ok: false, message: 'Could not save. Please try again.' };
  refresh();
  return { ok: true, message: 'Incomplete order saved.' };
}
