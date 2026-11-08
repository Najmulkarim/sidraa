'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth';
import { mapDbError } from '@/lib/db-errors';
import { landingSchema, type LandingInput } from '@/lib/landing';
import type { ActionState } from '@/lib/types';

export async function saveLanding(input: LandingInput): Promise<ActionState> {
  const { supabase } = await requirePermission('catalog');
  const parsed = landingSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, message: issue?.message ?? 'Please check the form.', fieldErrors: issue?.path[0] ? { [String(issue.path[0])]: issue.message } : undefined };
  }
  const l = parsed.data;
  if (l.couponCode) {
    const { data: c } = await supabase.from('coupons').select('code').eq('code', l.couponCode).maybeSingle();
    if (!c) return { ok: false, message: 'That coupon does not exist. Make it under Coupons first.', fieldErrors: { couponCode: 'Not found' } };
  }
  const row = {
    slug: l.slug, product_id: l.productId, is_active: l.isActive, headline: l.headline, subheadline: l.subheadline, offer_text: l.offerText,
    coupon_code: l.couponCode, video_url: l.videoUrl, benefits: l.benefits, faqs: l.faqs, button_text: l.buttonText,
    show_description: l.showDescription, show_reviews: l.showReviews,
  };
  const { data, error } = l.id
    ? await supabase.from('landing_pages').update(row).eq('id', l.id).select('id, slug').single()
    : await supabase.from('landing_pages').insert(row).select('id, slug').single();
  if (error) {
    if (error.code === '23505') return { ok: false, message: 'Another landing page already uses this link.', fieldErrors: { slug: 'Already used' } };
    const mapped = mapDbError(error);
    if (mapped.code === 'UNKNOWN') console.error('[admin] save landing', error);
    return { ok: false, message: mapped.message };
  }
  revalidatePath(`/offer/${data.slug}`);
  revalidatePath('/admin/landing-pages');
  if (!l.id) redirect(`/admin/landing-pages?created=${data.id}`);
  return { ok: true, message: 'Landing page saved.' };
}

export async function deleteLanding(id: string): Promise<ActionState> {
  const { supabase } = await requirePermission('catalog');
  if (!z.uuid().safeParse(id).success) return { ok: false, message: 'Not found.' };
  const { data, error } = await supabase.from('landing_pages').delete().eq('id', id).select('slug');
  if (error || !data?.length) return { ok: false, message: 'Could not delete. Please try again.' };
  revalidatePath(`/offer/${(data[0] as { slug: string }).slug}`);
  revalidatePath('/admin/landing-pages');
  return { ok: true, message: 'Landing page deleted.' };
}

/** The on/off switch in the list: off = the link shows "not found". */
export async function setLandingActive(id: string, on: boolean): Promise<ActionState> {
  const { supabase } = await requirePermission('catalog');
  if (!z.uuid().safeParse(id).success) return { ok: false, message: 'Not found.' };
  const { data, error } = await supabase.from('landing_pages').update({ is_active: on === true }).eq('id', id).select('slug');
  if (error || !data?.length) return { ok: false, message: 'Could not change it. Please try again.' };
  revalidatePath(`/offer/${(data[0] as { slug: string }).slug}`);
  revalidatePath('/admin/landing-pages');
  return { ok: true, message: on ? 'Landing page is ON — the link works.' : 'Landing page is OFF — the link is closed.' };
}
