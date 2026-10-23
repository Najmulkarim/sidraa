'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth';
import { loadEditableOrder, loadVariantOptions } from '@/lib/admin-data';
import { DB_FIELD_TO_FORM, mapDbError } from '@/lib/db-errors';
import { toNumber } from '@/lib/format';
import { RESTOCKING, STATUS_LABEL, isOrderStatus } from '@/lib/order-status';
import type { ActionState, DeliveryZone, EditableOrder, OrderHistory, OrderNote, VariantOption } from '@/lib/types';
import { bulkStatusSchema, editCustomerSchema, fieldErrors, formToObject, noteSchema, orderEditSchema, statusChangeSchema } from '@/lib/validation';

/** Every order change refreshes the admin lists; stock changes also refresh the shop. */
function refresh(orderId?: string, stockMoved = false) {
  revalidatePath('/admin/orders');
  revalidatePath('/admin');
  if (orderId) revalidatePath(`/admin/orders/${orderId}`);
  if (stockMoved) revalidatePath('/', 'layout');
}

function fail(error: Parameters<typeof mapDbError>[0], context: string): ActionState {
  const mapped = mapDbError(error);
  if (mapped.code === 'UNKNOWN') console.error(`[admin] ${context}`, error);
  return { ok: false, message: mapped.message };
}

const uuid = z.uuid();

/** Status form on the order detail page. Goes through set_order_status(),
 *  which enforces the workflow and returns stock exactly once. */
export async function changeOrderStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requirePermission('orders');
  const parsed = statusChangeSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, message: 'Choose a status.', fieldErrors: fieldErrors(parsed.error) };
  const { error } = await supabase.rpc('set_order_status', { p_order_id: parsed.data.orderId, p_status: parsed.data.status, p_note: parsed.data.note ?? null });
  if (error) return fail(error, 'set_order_status');
  refresh(parsed.data.orderId, RESTOCKING.includes(parsed.data.status));
  return { ok: true, message: `Marked as ${STATUS_LABEL[parsed.data.status]}.` };
}

/** Status dropdown in the orders table. */
export async function quickStatus(orderId: string, status: string): Promise<ActionState> {
  const { supabase } = await requirePermission('orders');
  if (!uuid.safeParse(orderId).success || !isOrderStatus(status)) return { ok: false, message: 'Invalid request.' };
  const { error } = await supabase.rpc('set_order_status', { p_order_id: orderId, p_status: status, p_note: null });
  if (error) return fail(error, 'quick status');
  refresh(orderId, RESTOCKING.includes(status));
  return { ok: true, message: `Marked as ${STATUS_LABEL[status]}.` };
}

export async function bulkStatus(ids: string[], status: string): Promise<ActionState> {
  const { supabase } = await requirePermission('orders');
  const parsed = bulkStatusSchema.safeParse({ ids, status });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Invalid request.' };
  const { data, error } = await supabase.rpc('bulk_set_order_status', { p_order_ids: parsed.data.ids, p_status: parsed.data.status, p_note: 'Bulk update' });
  if (error) return fail(error, 'bulk status');
  const r = data as { done: number; skipped: number };
  refresh(undefined, RESTOCKING.includes(parsed.data.status));
  const label = STATUS_LABEL[parsed.data.status];
  return {
    ok: r.done > 0,
    message: `${r.done} order${r.done === 1 ? '' : 's'} marked as ${label}.${r.skipped ? ` ${r.skipped} skipped — that move is not allowed from their status.` : ''}`,
  };
}

export async function addNote(orderId: string, body: string): Promise<ActionState> {
  const { supabase, user } = await requirePermission('orders');
  const parsed = noteSchema.safeParse({ orderId, body });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Invalid note.' };
  const { error } = await supabase.from('order_notes').insert({ order_id: parsed.data.orderId, body: parsed.data.body, created_by: user.id });
  if (error) return fail(error, 'add note');
  refresh(parsed.data.orderId);
  return { ok: true, message: 'Note added.' };
}

export type OrderLog = { at: string; kind: 'note' | 'system' | 'status'; text: string; by: string | null };

/** Notes, system lines and status changes for the Logs panel, newest first. */
export async function getOrderLogs(orderId: string): Promise<{ ok: boolean; logs: OrderLog[] }> {
  const { supabase } = await requirePermission('orders');
  if (!uuid.safeParse(orderId).success) return { ok: false, logs: [] };
  const [{ data: notes }, { data: history }, { data: staff }] = await Promise.all([
    supabase.from('order_notes').select('id, kind, body, created_by, created_at').eq('order_id', orderId),
    supabase.from('order_status_history').select('id, from_status, to_status, note, changed_by, created_at').eq('order_id', orderId),
    supabase.rpc('list_staff'),
  ]);
  const name = new Map(((staff ?? []) as { user_id: string; full_name: string }[]).map((s) => [s.user_id, s.full_name]));
  const logs: OrderLog[] = [
    ...((notes ?? []) as OrderNote[]).map((n) => ({ at: n.created_at, kind: n.kind, text: n.body, by: n.created_by ? name.get(n.created_by) ?? 'Admin' : null })),
    ...((history ?? []) as OrderHistory[]).map((h) => ({
      at: h.created_at,
      kind: 'status' as const,
      text: `${h.from_status ? `${STATUS_LABEL[h.from_status]} → ` : ''}${STATUS_LABEL[h.to_status]}${h.note ? ` — ${h.note}` : ''}`,
      by: h.changed_by ? name.get(h.changed_by) ?? 'Admin' : h.from_status ? null : 'Customer',
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  return { ok: true, logs };
}

export async function assignOrder(orderId: string, userId: string | null): Promise<ActionState> {
  const { supabase } = await requirePermission('orders');
  if (!uuid.safeParse(orderId).success || (userId !== null && !uuid.safeParse(userId).success)) return { ok: false, message: 'Invalid request.' };
  const { error } = await supabase.rpc('assign_order', { p_order_id: orderId, p_user_id: userId });
  if (error) return fail(error, 'assign');
  refresh(orderId);
  return { ok: true, message: userId ? 'Assigned.' : 'Unassigned.' };
}

/** Edit customer details (before shipping) and the paid amount. */
export async function editOrder(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requirePermission('orders');
  const parsed = editCustomerSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, message: 'Please fix the highlighted fields.', fieldErrors: fieldErrors(parsed.error) };
  const e = parsed.data;
  const { data: current } = await supabase.from('orders').select('status, paid_amount, customer_name, customer_phone, address, district, area, note').eq('id', e.orderId).single();
  if (!current) return { ok: false, message: 'Order not found.' };

  const changedCustomer =
    current.customer_name !== e.customerName || current.customer_phone !== e.customerPhone || current.address !== e.address ||
    current.district !== e.district || (current.area ?? undefined) !== e.area || (current.note ?? undefined) !== e.note;
  if (changedCustomer) {
    const { error } = await supabase.rpc('update_order_customer', {
      p_order_id: e.orderId,
      p_payload: { customer_name: e.customerName, customer_phone: e.customerPhone, address: e.address, district: e.district, area: e.area ?? null, note: e.note ?? null },
    });
    if (error) return fail(error, 'edit customer');
  }
  if (e.paid !== undefined && Number(current.paid_amount) !== e.paid) {
    const { error } = await supabase.rpc('record_payment', { p_order_id: e.orderId, p_paid: e.paid, p_note: null });
    if (error) return { ...fail(error, 'payment'), fieldErrors: { paid: mapDbError(error).message } };
  }
  refresh(e.orderId);
  return { ok: true, message: changedCustomer || e.paid !== undefined ? 'Order updated.' : 'Nothing changed.' };
}

export async function deleteOrder(orderId: string): Promise<ActionState> {
  const { supabase } = await requirePermission('orders_delete');
  if (!uuid.safeParse(orderId).success) return { ok: false, message: 'Invalid request.' };
  const { error } = await supabase.rpc('delete_order', { p_order_id: orderId });
  if (error) {
    const m = mapDbError(error);
    return { ok: false, message: m.code === 'BAD_TRANSITION' ? 'Orders with the courier or delivered cannot be deleted.' : m.message };
  }
  refresh(orderId, true);
  return { ok: true, message: 'Order deleted. Find it under the Deleted tab.' };
}

export async function restoreOrder(orderId: string): Promise<ActionState> {
  const { supabase } = await requirePermission('orders_delete');
  if (!uuid.safeParse(orderId).success) return { ok: false, message: 'Invalid request.' };
  const { error } = await supabase.rpc('restore_order', { p_order_id: orderId });
  if (error) return fail(error, 'restore');
  refresh(orderId);
  return { ok: true, message: 'Order restored (it stays cancelled).' };
}

export type EditorData = {
  ok: boolean;
  message?: string;
  order?: EditableOrder;
  options?: VariantOption[];
  zones?: DeliveryZone[];
  canEditItems?: boolean;
};

/** Loads an order for the edit dialog. Product sizes only for orders_edit. */
export async function getOrderEditor(orderId: string): Promise<EditorData> {
  const { supabase, can } = await requirePermission('orders');
  if (!uuid.safeParse(orderId).success) return { ok: false, message: 'Invalid request.' };
  const canEditItems = can.has('orders_edit');
  const [order, options, { data: zones }] = await Promise.all([
    loadEditableOrder(supabase, orderId),
    canEditItems ? loadVariantOptions(supabase) : Promise.resolve([]),
    supabase.from('delivery_zones').select('id, name, charge, free_over, eta_text, sort_order, is_active').order('sort_order'),
  ]);
  if (!order) return { ok: false, message: 'Order not found.' };
  return { ok: true, order, options, zones: (zones ?? []) as DeliveryZone[], canEditItems };
}

/**
 * Full edit (items, sizes, quantities, prices, area, delivery charge,
 * discount, customer) or a new manual order. admin_save_order() checks
 * orders_edit, stock and the order's status again and recalculates totals.
 */
export async function saveOrderFull(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, can } = await requirePermission('orders_edit');
  const parsed = orderEditSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    const errs = fieldErrors(parsed.error);
    const line = Object.entries(errs).find(([k]) => k.startsWith('items'));
    const lineNo = line ? Number(line[0].split('.')[1]) : NaN;
    if (line) errs.items = Number.isInteger(lineNo) ? `Line ${lineNo + 1}: ${line[1]}` : line[1];
    return { ok: false, message: line ? errs.items : errs._form ?? 'Please fix the highlighted fields.', fieldErrors: errs };
  }
  const o = parsed.data;

  const { data, error } = await supabase
    .rpc('admin_save_order', {
      p_order_id: o.orderId ?? null,
      p_payload: {
        idempotency_key: o.idempotencyKey ?? null,
        customer_name: o.customerName,
        customer_phone: o.customerPhone,
        address: o.address,
        district: o.district,
        area: o.area ?? null,
        note: o.note ?? null,
        zone_id: o.zoneId,
        delivery_charge: o.deliveryCharge ?? null,
        discount: o.discount,
        source: o.source,
        status: o.status ?? 'pending',
        items: o.items.map((l) => ({ variant_id: l.variantId, quantity: l.quantity, unit_price: l.unitPrice })),
      },
    })
    .single<{ order_id: string; public_ref: string; total: number | string }>();
  if (error || !data) {
    const m = mapDbError(error);
    if (m.code === 'UNKNOWN') console.error('[admin] admin_save_order', error);
    const field = m.field ? DB_FIELD_TO_FORM[m.field] ?? m.field : undefined;
    return { ok: false, message: m.message, fieldErrors: field ? { [field]: m.message } : undefined };
  }

  // Advance payment (bKash / Nagad) is a separate, audited step.
  let paidNote = '';
  if (o.paid !== undefined && can.has('orders')) {
    const { data: cur } = await supabase.from('orders').select('paid_amount').eq('id', data.order_id).single();
    if (cur && toNumber(cur.paid_amount) !== o.paid) {
      const { error: payErr } = await supabase.rpc('record_payment', { p_order_id: data.order_id, p_paid: o.paid, p_note: null });
      if (payErr) paidNote = ` Paid amount not saved: ${mapDbError(payErr).message}`;
    }
  }
  refresh(data.order_id, true);
  return {
    ok: !paidNote,
    message: o.orderId ? `Order ${data.public_ref} saved.${paidNote}` : `Order ${data.public_ref} created.${paidNote}`,
    values: { orderId: data.order_id, publicRef: data.public_ref },
  };
}
