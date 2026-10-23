import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/admin/LoginForm';
import { Logo } from '@/components/shop/Header';
import { getAdmin } from '@/lib/auth';
import { getSettings } from '@/lib/catalog';

export const metadata: Metadata = { title: 'Admin sign in', robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [{ error }, settings, session] = await Promise.all([searchParams, getSettings(), getAdmin()]);
  if (session?.profile && !session.needsMfa) redirect('/admin');
  if (session?.needsMfa) redirect('/admin/login/verify');

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10" style={{ background: 'var(--hero)' }}>
      <div className="w-full max-w-sm space-y-6 rounded-2xl bg-white p-8 shadow-2xl">
        <div className="flex flex-col items-center gap-2 text-center">
          <Logo settings={settings} className="h-14" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Admin panel</p>
        </div>
        <LoginForm notice={error === 'not-admin' ? 'That account is not an admin. Sign in with an admin account.' : undefined} />
      </div>
    </main>
  );
}
