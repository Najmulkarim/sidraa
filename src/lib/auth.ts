import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { capabilitiesFor, isRole, type AdminRole, type Capability } from '@/lib/permissions';

export type { AdminRole } from '@/lib/permissions';
export type AdminProfile = { user_id: string; full_name: string; role: AdminRole; is_active: boolean };

/**
 * The signed-in admin for this request, or null. getClaims() verifies the
 * access token's signature against the project's public signing key (it
 * does not trust the cookie alone), locally rather than by asking Supabase
 * Auth. A deactivated or deleted admin still loses access at once: the
 * profile read below and is_admin() in the database check that on every
 * request. Second wall after src/proxy.ts; RLS and has_permission() are
 * the third.
 */
export const getAdmin = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  const user = { id: claims.sub, email: typeof claims.email === 'string' ? claims.email : undefined };

  // The assurance level is read from the session already loaded above, so
  // all three can run together.
  const [{ data: aal }, { data: profile }, { data: mine }] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.from('admin_profiles').select('user_id, full_name, role, is_active').eq('user_id', user.id).maybeSingle<AdminProfile>(),
    supabase.rpc('my_permissions'),
  ]);
  const needsMfa = aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2';
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
