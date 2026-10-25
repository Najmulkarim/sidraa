'use server';

import { z } from 'zod';
import { clientIp, hit, LIMITS } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ActionState } from '@/lib/types';

const emailSchema = z.email('Enter a valid email address').max(200);

/** Footer newsletter sign-up. Rate limited per IP; a repeat address is a friendly no-op. */
export async function subscribeNewsletter(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = emailSchema.safeParse(String(formData.get('email') ?? '').trim().toLowerCase());
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Enter a valid email address' };
  if (!(await hit('newsletter', await clientIp(), LIMITS.newsletterIp))) {
    return { ok: false, message: 'Too many tries. Please try again later.' };
  }
  const { error } = await createAdminClient().from('newsletter_subscribers').insert({ email: parsed.data });
  if (error && error.code !== '23505') {
    console.error('[newsletter]', error.message);
    return { ok: false, message: 'Could not sign you up right now. Please try again.' };
  }
  return { ok: true, message: error ? 'You are already on the list. Thank you!' : 'Thank you! You will hear about new arrivals and offers first.' };
}
