'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { expenseSchema } from '@/lib/accounting';
import { requirePermission } from '@/lib/auth';
import { isYmd } from '@/lib/format';
import type { ActionState } from '@/lib/types';

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
