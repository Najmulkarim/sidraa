'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth';
import { CATALOG_TAG } from '@/lib/catalog';
import { canonicalRef } from '@/lib/order-ref';
import { normalizeBdPhone } from '@/lib/phone';
import { clientIp, hit, LIMITS } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ActionState } from '@/lib/types';

/**
 * Product reviews. Customers review a product they received: the order
 * number and phone must match a delivered order that has the product. New
 * reviews wait for the shop's approval; only approved ones show (and count
 * towards the stars).
 */

const reviewSchema = z.object({
  productId: z.uuid(),
  ref: z.string().trim().min(4, 'Enter your order number, e.g. Order0001').max(30),
  phone: z.string().trim().max(20),
  name: z.string().trim().min(2, 'Enter your name').max(60),
  rating: z.coerce.number().int().min(1, 'Choose 1 to 5 stars').max(5),
  comment: z.string().trim().max(600).optional().default(''),
});

export type ReviewState = ActionState & { errors?: Partial<Record<'ref' | 'phone' | 'name' | 'rating' | 'comment', string>> };

export async function submitReview(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const parsed = reviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const errors: ReviewState['errors'] = {};
    for (const i of parsed.error.issues) errors[i.path[0] as keyof NonNullable<ReviewState['errors']>] ??= i.message;
    return { ok: false, errors };
  }
  const { productId, name, rating, comment } = parsed.data;
  const ref = canonicalRef(parsed.data.ref);
  const phone = normalizeBdPhone(parsed.data.phone);
  if (!ref) return { ok: false, errors: { ref: 'Enter your order number, e.g. Order0001' } };
  if (!phone) return { ok: false, errors: { phone: 'Enter the phone number you ordered with' } };
  if (!(await hit('review', await clientIp(), LIMITS.reviewIp))) return { ok: false, message: 'Too many tries. Please try again later.' };

  const admin = createAdminClient();
  const { data: order } = await admin
    .from('orders')
    .select('id, status, order_items(product_id)')
    .eq('public_ref', ref)
    .eq('customer_phone', phone)
    .maybeSingle<{ id: string; status: string; order_items: { product_id: string | null }[] }>();
  // Same answer whichever detail was wrong.
  if (!order || !order.order_items.some((i) => i.product_id === productId)) {
    return { ok: false, message: 'We could not find this product in an order with that number and phone.' };
  }
  if (order.status !== 'delivered') return { ok: false, message: 'You can review this product once your order has been delivered. Thank you!' };

  const { error } = await admin.from('product_reviews').insert({ product_id: productId, order_id: order.id, name, rating, comment: comment || null, source: 'customer', status: 'pending' });
  if (error?.code === '23505') return { ok: false, message: 'You have already reviewed this product for this order. Thank you!' };
  if (error) {
    console.error('[review]', error.message);
    return { ok: false, message: 'Could not save your review right now. Please try again.' };
  }
  return { ok: true, message: 'Thank you! Your review will appear after a quick check.' };
}

// ------------------------------------------------------------------ admin

function refresh() {
  updateTag(CATALOG_TAG);
  revalidatePath('/', 'layout');
  revalidatePath('/admin/reviews');
}

export async function setReviewStatus(id: string, status: 'approved' | 'hidden'): Promise<ActionState> {
  const { supabase } = await requirePermission('catalog');
  if (!z.uuid().safeParse(id).success || !['approved', 'hidden'].includes(status)) return { ok: false, message: 'Invalid review.' };
  const { error } = await supabase.from('product_reviews').update({ status }).eq('id', id);
  if (error) return { ok: false, message: 'Could not save. Please try again.' };
  refresh();
  return { ok: true, message: status === 'approved' ? 'Approved — it shows on the product now, with its stars.' : 'Hidden from the shop.' };
}

export async function deleteReview(id: string): Promise<ActionState> {
  const { supabase } = await requirePermission('catalog');
  if (!z.uuid().safeParse(id).success) return { ok: false, message: 'Invalid review.' };
  const { error } = await supabase.from('product_reviews').delete().eq('id', id);
  if (error) return { ok: false, message: 'Could not delete. Please try again.' };
  refresh();
  return { ok: true, message: 'Review deleted.' };
}

const shopReviewSchema = z.object({
  productId: z.uuid('Choose a product'),
  name: z.string().trim().min(2, 'Enter the customer’s name').max(60),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(600).optional().default(''),
});

/** A review a customer sent the shop (Facebook, WhatsApp, phone) — added by staff, shown at once. */
export async function addShopReview(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requirePermission('catalog');
  const parsed = shopReviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Check the form.' };
  const { productId, name, rating, comment } = parsed.data;
  const { error } = await supabase.from('product_reviews').insert({ product_id: productId, name, rating, comment: comment || null, source: 'shop', status: 'approved' });
  if (error) return { ok: false, message: 'Could not save. Please try again.' };
  refresh();
  return { ok: true, message: 'Review added — it shows on the product now.' };
}
