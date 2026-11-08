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
      // A listed variation, or a new product written on the line (variantId null).
      variantId: z.uuid().nullable(),
      /** Already confirmed: locked, never sent back to the database. */
      received: z.boolean().optional(),
      newName: z.string().trim().max(160).nullable().optional(),
      newColor: z.string().trim().max(30).nullable().optional(),
      newSize: z.string().trim().max(20).nullable().optional(),
      newImage: z.string().trim().max(300).nullable().optional(),
      newPrice: z.number().min(0).max(10_000_000).nullable().optional(),
      quantity: z.number().int('Whole numbers only').min(1, 'Quantity must be at least 1').max(100000),
      unitCost: z.number().min(0).max(10_000_000).nullable(),
    }).refine((i) => i.variantId || i.newName, 'Write the name of the new product'))
    .min(1, 'Add at least one product')
    .max(300, 'At most 300 lines')
    .refine((xs) => { const keys = xs.filter((x) => !x.received).map((x) => x.variantId ?? `new:${x.newName?.toLowerCase()}|${(x.newColor ?? '').toLowerCase()}|${(x.newSize ?? '').toLowerCase()}`); return new Set(keys).size === keys.length; }, 'The same item is added twice'),
});
export type StockOrderInput = z.input<typeof stockOrderSchema>;

function refresh(id?: string) {
  revalidatePath('/admin/inventory');
  revalidatePath('/admin/inventory/stock-orders');
  if (id) revalidatePath(`/admin/inventory/stock-orders/${id}`);
}

/** Save a draft purchase order (the lines are replaced as a whole). */
export async function saveStockOrder(input: StockOrderInput): Promise<ActionState> {
  const { supabase, user } = await requirePermission('inventory');
  const parsed = stockOrderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  const o = parsed.data;
  const head = { supplier: o.supplier, supplier_phone: o.supplierPhone, note: o.note, expected_on: o.expectedOn };

  let id = o.id;
  if (id) {
    const { data, error } = await supabase.from('stock_orders').update(head).eq('id', id).in('status', ['draft', 'received']).select('id');
    if (error) return fail(error);
    if (!data?.length) return { ok: false, message: 'This purchase order was cancelled — it cannot be changed.' };
    // Only pending lines are replaced; confirmed lines stay exactly as they are.
    const { error: delErr } = await supabase.from('stock_order_items').delete().eq('stock_order_id', id).is('received_at', null);
    if (delErr) return fail(delErr);
  } else {
    const { data, error } = await supabase.from('stock_orders').insert({ ...head, created_by: user.id }).select('id').single();
    if (error || !data) return fail(error);
    id = data.id as string;
  }
  const pending = o.items.filter((i) => !i.received);
  const { error: itemsErr } = pending.length === 0 ? { error: null } : await supabase.from('stock_order_items').insert(pending.map((i) => ({
    stock_order_id: id, variant_id: i.variantId, quantity: i.quantity, unit_cost: i.unitCost,
    ...(i.variantId ? {} : { new_name: i.newName || null, new_color: i.newColor || null, new_size: i.newSize || null, new_image: i.newImage || null, new_price: i.newPrice ?? null }),
  })));
  if (itemsErr) return fail(itemsErr);

  refresh(id);
  if (!o.id) redirect(`/admin/inventory/stock-orders/${id}?created=1`);
  return { ok: true, message: 'Purchase order saved.' };
}

/** Receive: every line goes into stock now. */
export async function receiveStockOrder(id: string, saveCosts: boolean): Promise<ActionState> {
  const { supabase } = await requirePermission('inventory');
  if (!z.uuid().safeParse(id).success) return { ok: false, message: 'Not found.' };
  const { data, error } = await supabase.rpc('receive_stock_order', { p_order_id: id, p_save_costs: saveCosts === true });
  if (error) return fail(error);
  refresh(id);
  // New products were made as drafts; the shop shows stock too.
  revalidatePath('/admin/products');
  revalidatePath('/', 'layout');
  updateTag(CATALOG_TAG);
  return { ok: true, message: `Confirmed: ${Number(data ?? 0)} units added to stock.` };
}

export async function cancelStockOrder(id: string): Promise<ActionState> {
  const { supabase } = await requirePermission('inventory');
  if (!z.uuid().safeParse(id).success) return { ok: false, message: 'Not found.' };
  const { data, error } = await supabase.from('stock_orders').update({ status: 'cancelled' }).eq('id', id).eq('status', 'draft').select('id');
  if (error) return fail(error);
  if (!data?.length) return { ok: false, message: 'Only a draft can be cancelled.' };
  refresh(id);
  return { ok: true, message: 'Purchase order cancelled. Stock was not changed.' };
}

export async function deleteStockOrder(id: string): Promise<ActionState> {
  const { supabase } = await requirePermission('inventory');
  if (!z.uuid().safeParse(id).success) return { ok: false, message: 'Not found.' };
  const { data, error } = await supabase.from('stock_orders').delete().eq('id', id).in('status', ['draft', 'cancelled']).select('id');
  if (error) return fail(error);
  if (!data?.length) return { ok: false, message: 'A received order stays in the records.' };
  refresh();
  return { ok: true, message: 'Purchase order deleted.' };
}

function fail(error: Parameters<typeof mapDbError>[0]): ActionState {
  const mapped = mapDbError(error);
  if (mapped.code === 'UNKNOWN') console.error('[admin] stock order', error);
  return { ok: false, message: mapped.message };
}
