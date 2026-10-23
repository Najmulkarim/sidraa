import type { Metadata } from 'next';
import { MfaSetup } from '@/components/admin/MfaSetup';
import { requireAdmin } from '@/lib/auth';
import { ROLE_LABEL } from '@/lib/permissions';

export const metadata: Metadata = { title: 'My account' };

export default async function AccountPage() {
  const { user, profile } = await requireAdmin();
  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">My account</h1>
        <p className="text-sm text-muted">{profile.full_name} · {user.email} · {ROLE_LABEL[profile.role]}</p>
      </header>
      <MfaSetup />
      <section className="card p-5 text-sm text-muted">
        To change your password, use “Forgot password” in the Supabase dashboard (Authentication → Users → Send password recovery) or ask the owner.
      </section>
    </div>
  );
}
