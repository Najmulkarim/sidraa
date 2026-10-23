import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { signOut } from '@/actions/auth';
import { MfaVerify } from '@/components/admin/MfaVerify';
import { getAdmin } from '@/lib/auth';

export const metadata: Metadata = { title: 'Two-factor check', robots: { index: false, follow: false } };

export default async function VerifyPage() {
  const session = await getAdmin();
  if (!session) redirect('/admin/login');
  if (!session.needsMfa) redirect('/admin');

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10" style={{ background: 'var(--hero)' }}>
      <div className="w-full max-w-sm space-y-6 rounded-2xl bg-white p-8 shadow-2xl">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Two-factor check</h1>
          <p className="text-sm text-muted">Open your authenticator app and enter the current code.</p>
        </div>
        <MfaVerify />
        <form action={signOut} className="text-center">
          <button className="text-sm text-muted underline">Use a different account</button>
        </form>
      </div>
    </main>
  );
}
