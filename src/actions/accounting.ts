'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { expenseSchema } from '@/lib/accounting';
import { requirePermission } from '@/lib/auth';
import { isYmd } from '@/lib/format';
import type { ActionState } from '@/lib/types';
import { mapDbError } from '@/lib/db-errors';

/** Accounting: expenses and cost re-calculation. Only staff who may see money (revenue). */

export async function saveExpense(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requirePermission('revenue');
  const parsed = expenseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Check the form.' };
  const e = parsed.data;
  if (!isYmd(e.spentOn)) return { ok: false, message: 'Choose a valid date.' };
  const row = { spent_on: e.spentOn, category: e.category, amount: e.amount, paid_via: e.paidVia, reference: e.reference || null, note: e.note || null, updated_at: new Date().toISOString() };
  const { error } = e.id ? await supabase.from('expenses').update(row).eq('id', e.id) : await supabase.from('expenses').insert(row);
  if (error) {
    console.error('[accounting] save expense', error.message);
    return { ok: false, message: 'Could not save. Run the latest database update (0033) in Supabase, then try again.' };
  }
  revalidatePath('/admin/accounting');
  return { ok: true, message: e.id ? 'Expense updated.' : 'Expense added — profit is updated.' };
}

export async function deleteExpense(id: string): Promise<ActionState> {
  const { supabase } = await requirePermission('revenue');
  if (!z.uuid().safeParse(id).success) return { ok: false, message: 'Invalid expense.' };
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) return { ok: false, message: 'Could not delete. Please try again.' };
  revalidatePath('/admin/accounting');
  return { ok: true, message: 'Expense deleted.' };
}

/** Gives the delivered sales of a period today's cost prices (after a cost was missing or wrong). */
export async function reapplyCosts(from: string, to: string): Promise<ActionState> {
  const { supabase } = await requirePermission('revenue');
  if (!isYmd(from) || !isYmd(to) || to < from) return { ok: false, message: 'Choose a valid period.' };
  const { data, error } = await supabase.rpc('reapply_item_costs', { p_from: from, p_to: to });
  if (error) return { ok: false, message: 'Could not update. Please try again.' };
  revalidatePath('/admin/accounting');
  return { ok: true, message: `Done — ${Number(data ?? 0)} sold item line${Number(data) === 1 ? '' : 's'} now use the current cost prices.` };
}

const checkSchema = z.object({
  orderId: z.uuid(),
  paid: z.number().min(0).max(99_999_999),
  checked: z.boolean(),
  charge: z.number().min(0).max(100_000).nullable(),
  codFee: z.number().min(0).max(100_000).nullable(),
});
const r2 = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(Number(n)) ? null : Math.round(Number(n) * 100) / 100);

/** Marks one courier parcel's payment as checked (with what was really collected), or undoes the check. */
export async function checkOrderPayment(orderId: string, paid: number, checked = true, charge: number | null = null, codFee: number | null = null): Promise<ActionState> {
  const { supabase } = await requirePermission('revenue');
  const p = checkSchema.safeParse({ orderId, paid: r2(paid), checked, charge: r2(charge), codFee: r2(codFee) });
  if (!p.success) return { ok: false, message: 'Enter the cash collected and the delivery charge (0 or more).' };
  const { error } = await supabase.rpc('check_order_payment', {
    p_order_id: p.data.orderId, p_paid: p.data.paid, p_checked: p.data.checked, p_charge: p.data.charge, p_cod_fee: p.data.codFee,
  });
  if (error) return { ok: false, message: mapDbError(error).message };
  revalidatePath('/admin/accounting', 'layout');
  revalidatePath(`/admin/orders/${p.data.orderId}`);
  return { ok: true, message: p.data.checked ? 'Payment checked.' : 'Check undone.' };
}

/** Sets a courier's COD fee rate (percent) from now on; parcels handed over earlier keep their rate. */
export async function setCodRate(courier: string, rate: number): Promise<ActionState> {
  const { supabase } = await requirePermission('revenue');
  const p = z.object({ courier: z.enum(['pathao', 'steadfast']), rate: z.number().min(0).max(20) }).safeParse({ courier, rate: Math.round(Number(rate) * 1000) / 1000 });
  if (!p.success) return { ok: false, message: 'COD fee must be between 0% and 20%.' };
  const { error } = await supabase.rpc('set_courier_cod_rate', { p_courier: p.data.courier, p_rate: p.data.rate });
  if (error) return { ok: false, message: mapDbError(error).message };
  revalidatePath('/admin/accounting', 'layout');
  return { ok: true, message: `COD fee set to ${p.data.rate}% from now on.` };
}
