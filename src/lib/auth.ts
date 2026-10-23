import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { capabilitiesFor, isRole, type AdminRole, type Capability } from '@/lib/permissions';

export type { AdminRole } from '@/lib/permissions';
export type AdminProfile = { user_id: string; full_name: string; role: AdminRole; is_active: boolean };

/**
 * The signed-in admin for this request, or null. getUser() asks Supabase
 * Auth to verify the session (it does not trust the cookie alone).
 * Second wall after src/proxy.ts; RLS and has_permission() are the third.
 */
export const getAdmin = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const needsMfa = aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2';

  const [{ data: profile }, { data: mine }] = await Promise.all([
    supabase.from('admin_profiles').select('user_id, full_name, role, is_active').eq('user_id', user.id).maybeSingle<AdminProfile>(),
    supabase.rpc('my_permissions'),
  ]);
  const active: AdminProfile | null = profile && profile.is_active && isRole(profile.role) ? (profile as AdminProfile) : null;
  const granted = ((mine as { permissions?: string[] } | null)?.permissions ?? []) as string[];
  const can = active ? capabilitiesFor(active.role, granted) : new Set<Capability>();

  return { supabase, user, profile: active, needsMfa, can };
});

/** Use at the top of every admin page and admin Server Action. */
export async function requireAdmin() {
  const session = await getAdmin();
  if (!session) redirect('/admin/login');
  if (session.needsMfa) redirect('/admin/login/verify');
  // With MFA satisfied, a missing profile means this account is not an admin.
  if (!session.profile) redirect('/admin/login?error=not-admin');
  return { ...session, profile: session.profile };
}

/**
 * Pages and actions that need a permission. The database checks the same
 * permission again (has_permission / require_permission), so hiding a
 * button is never the only protection.
 */
export async function requirePermission(...needed: Capability[]) {
  const session = await requireAdmin();
  if (!needed.every((p) => session.can.has(p))) redirect(`/admin?denied=${needed.join(',')}`);
  return session;
}

/** Staff and roles: super admins only. */
export function requireSuperAdmin() {
  return requirePermission('staff');
}
