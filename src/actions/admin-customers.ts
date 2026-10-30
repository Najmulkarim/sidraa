'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth';
import { CATALOG_TAG } from '@/lib/catalog';
import { mapDbError } from '@/lib/db-errors';
import type { ActionState } from '@/lib/types';
import { blockSchema, couponSchema, fieldErrors, formToObject } from '@/lib/validation';

// --------------------------------------------------------------- block list

/** Blocked numbers cannot place orders on the website (place_order refuses them). */
export async function blockPhone(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requirePermission('customers');
  const parsed = blockSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, message: 'Please fix the highlighted fields.', fieldErrors: fieldErrors(parsed.error) };
  const { error } = await supabase.rpc('block_phone', { p_phone: parsed.data.phone, p_reason: parsed.data.reason ?? null });
  if (error) return { ok: false, message: mapDbError(error).message };
  revalidatePath('/admin/customers');
  revalidatePath('/admin/orders');
  return { ok: true, message: `${parsed.data.phone} is blocked from ordering online.` };
}

export async function quickBlock(phone: string, reason: string | null, block: boolean): Promise<ActionState> {
  const { supabase } = await requirePermission('customers');
  if (!/^01[3-9]\d{8}$/.test(phone)) return { ok: false, message: 'Invalid number.' };
  const { error } = block
    ? await supabase.rpc('block_phone', { p_phone: phone, p_reason: reason?.slice(0, 200) ?? null })
    : await supabase.rpc('unblock_phone', { p_phone: phone });
  if (error) return { ok: false, message: mapDbError(error).message };
  revalidatePath('/admin/customers');
  revalidatePath('/admin/orders');
  return { ok: true, message: block ? `${phone} blocked.` : `${phone} unblocked.` };
}

// ------------------------------------------------------------------ coupons

const dhakaStart = (ymd: string) => new Date(`${ymd}T00:00:00+06:00`).toISOString();

export async function saveCoupon(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requirePermission('catalog');
  const parsed = couponSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, message: 'Please fix the highlighted fields.', fieldErrors: fieldErrors(parsed.error) };
  const c = parsed.data;
  const row = {
    code: c.code,
    kind: c.kind,
    value: c.value,
    min_subtotal: c.minSubtotal,
    max_discount: c.kind === 'percent' ? (c.maxDiscount ?? null) : null,
    starts_at: c.startsAt ? dhakaStart(c.startsAt) : null,
    // "Ends" is inclusive: the code works for the whole end day (Dhaka time).
    ends_at: c.endsAt ? new Date(new Date(dhakaStart(c.endsAt)).getTime() + 86_400_000).toISOString() : null,
    usage_limit: c.usageLimit ?? null,
    is_active: c.isActive,
    first_order_only: c.firstOrderOnly,
  };
  const { error } = c.existing
    ? await supabase.from('coupons').update(row).eq('code', c.code)
    : await supabase.from('coupons').insert(row);
  if (error) {
    const m = mapDbError(error);
    return { ok: false, message: m.code === 'DUPLICATE' ? 'That code already exists.' : m.message, fieldErrors: m.code === 'DUPLICATE' ? { code: 'Already exists' } : undefined };
  }
  revalidatePath('/admin/coupons');
  updateTag(CATALOG_TAG); // the leaving-the-site popup follows its code
  return { ok: true, message: c.existing ? `${c.code} saved.` : `${c.code} created.` };
}

export async function deleteCoupon(code: string): Promise<ActionState> {
  const { supabase } = await requirePermission('catalog');
  if (!z.string().regex(/^[A-Z0-9_-]{3,24}$/).safeParse(code).success) return { ok: false, message: 'Invalid code.' };
  const { error } = await supabase.from('coupons').delete().eq('code', code);
  if (error) return { ok: false, message: mapDbError(error).message };
  revalidatePath('/admin/coupons');
  updateTag(CATALOG_TAG);
  return { ok: true, message: `${code} deleted. Past orders keep their discount.` };
}

/** Plain form version for lists rendered on the server. */
export async function unblockPhoneForm(formData: FormData): Promise<void> {
  const { supabase } = await requirePermission('customers');
  const phone = String(formData.get('phone') ?? '');
  if (/^01[3-9]\d{8}$/.test(phone)) await supabase.rpc('unblock_phone', { p_phone: phone });
  revalidatePath('/admin/customers');
}
