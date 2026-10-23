'use server';

import { redirect } from 'next/navigation';
import { clientIp, hit, LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import type { ActionState } from '@/lib/types';
import { fieldErrors, formToObject, loginSchema } from '@/lib/validation';

/**
 * Admin sign-in. Rate-limited per IP and per email; the same message is
 * shown for a wrong email or a wrong password. There is no sign-up action
 * anywhere in the app — see docs/first-admin.md.
 */
export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = formToObject(formData);
  const values = { email: String(raw.email ?? '').slice(0, 120) };
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error), values };

  const ip = await clientIp();
  const allowed = (await hit('login:ip', ip, LIMITS.loginIp)) && (await hit('login:email', parsed.data.email.toLowerCase(), LIMITS.loginEmail));
  if (!allowed) return { ok: false, message: 'Too many sign-in attempts. Wait 15 minutes and try again.', values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, message: 'Email or password is incorrect.', values };

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') redirect('/admin/login/verify');

  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (isAdmin !== true) {
    await supabase.auth.signOut();
    return { ok: false, message: 'This account does not have access to the admin panel.', values };
  }
  redirect('/admin');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/admin/login');
}
