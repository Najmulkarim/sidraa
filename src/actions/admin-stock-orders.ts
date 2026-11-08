'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth';
import { CATALOG_TAG } from '@/lib/catalog';
import { mapDbError } from '@/lib/db-errors';
import type { ActionState } from '@/lib/types';

const stockOrderSchema = z.object({
  id: z.uuid().optional(),
  supplier: z.string().trim().max(120).transform((v) => v || null),
  supplierPhone: z.string().trim().max(30).transform((v) => v || null),
  note: z.string().trim().max(1000).transform((v) => v || null),
  expectedOn: z.string().trim().refine((v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Use a date').transform((v) => v || null),
  items: z
    .array(z.object({
      variantId: z.uuid(),
      quantity: z.number().int('Whole numbers only').min(1, 'Quantity must be at least 1').max(100000),
      unitCost: z.number().min(0).max(10_000_000).nullable(),
    }))
    .min(1, 'Add at least one product')
    .max(300, 'At most 300 lines')
    .refine((xs) => new Set(xs.map((x) => x.variantId)).size === xs.length, 'The same item is added twice'),
});
export type StockOrderInput = z.input<typeof stockOrderSchema>;

function refresh(id?: string) {
  revalidatePath('/admin/inventory');
  revalidatePath('/admin/inventory/stock-orders');
  if (id) revalidatePath(`/admin/inventory/stock-orders/${id}`);
}

/** Save a draft stock-in order (the lines are replaced as a whole). */
export async function saveStockOrder(input: StockOrderInput): Promise<ActionState> {
  const { supabase, user } = await requirePermission('inventory');
  const parsed = stockOrderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  const o = parsed.data;
  const head = { supplier: o.supplier, supplier_phone: o.supplierPhone, note: o.note, expected_on: o.expectedOn };

  let id = o.id;
  if (id) {
    const { data, error } = await supabase.from('stock_orders').update(head).eq('id', id).eq('status', 'draft').select('id');
    if (error) return fail(error);
    if (!data?.length) return { ok: false, message: 'This order was already received or cancelled — it cannot be changed.' };
    const { error: delErr } = await supabase.from('stock_order_items').delete().eq('stock_order_id', id);
    if (delErr) return fail(delErr);
  } else {
    const { data, error } = await supabase.from('stock_orders').insert({ ...head, created_by: user.id }).select('id').single();
    if (error || !data) return fail(error);
    id = data.id as string;
  }
  const { error: itemsErr } = await supabase.from('stock_order_items').insert(o.items.map((i) => ({ stock_order_id: id, variant_id: i.variantId, quantity: i.quantity, unit_cost: i.unitCost })));
  if (itemsErr) return fail(itemsErr);

  refresh(id);
  if (!o.id) redirect(`/admin/inventory/stock-orders/${id}?created=1`);
  return { ok: true, message: 'Stock-in order saved.' };
}

/** Receive: every line goes into stock now. */
export async function receiveStockOrder(id: string, saveCosts: boolean): Promise<ActionState> {
  const { supabase } = await requirePermission('inventory');
  if (!z.uuid().safeParse(id).success) return { ok: false, message: 'Not found.' };
  const { data, error } = await supabase.rpc('receive_stock_order', { p_order_id: id, p_save_costs: saveCosts === true });
  if (error) return fail(error);
  refresh(id);
  // The shop shows stock too.
  revalidatePath('/', 'layout');
  updateTag(CATALOG_TAG);
  return { ok: true, message: `Received: ${Number(data ?? 0)} units added to stock.` };
}

export async function cancelStockOrder(id: string): Promise<ActionState> {
  const { supabase } = await requirePermission('inventory');
  if (!z.uuid().safeParse(id).success) return { ok: false, message: 'Not found.' };
  const { data, error } = await supabase.from('stock_orders').update({ status: 'cancelled' }).eq('id', id).eq('status', 'draft').select('id');
  if (error) return fail(error);
  if (!data?.length) return { ok: false, message: 'Only a draft can be cancelled.' };
  refresh(id);
  return { ok: true, message: 'Stock-in order cancelled. Stock was not changed.' };
}

export async function deleteStockOrder(id: string): Promise<ActionState> {
  const { supabase } = await requirePermission('inventory');
  if (!z.uuid().safeParse(id).success) return { ok: false, message: 'Not found.' };
  const { data, error } = await supabase.from('stock_orders').delete().eq('id', id).in('status', ['draft', 'cancelled']).select('id');
  if (error) return fail(error);
  if (!data?.length) return { ok: false, message: 'A received order stays in the records.' };
  refresh();
  return { ok: true, message: 'Stock-in order deleted.' };
}

function fail(error: Parameters<typeof mapDbError>[0]): ActionState {
  const mapped = mapDbError(error);
  if (mapped.code === 'UNKNOWN') console.error('[admin] stock order', error);
  return { ok: false, message: mapped.message };
}
