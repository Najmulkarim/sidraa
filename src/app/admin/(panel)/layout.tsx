import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { signOut } from '@/actions/auth';
import { AdminNav } from '@/components/admin/AdminNav';
import { Icon } from '@/components/icons';
import { Logo } from '@/components/shop/Header';
import { requireAdmin } from '@/lib/auth';
import { getSettings } from '@/lib/catalog';
import { ROLE_LABEL } from '@/lib/permissions';

export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s · Admin' },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const [{ profile, can }, settings] = await Promise.all([requireAdmin(), getSettings()]);

  return (
    <div className="min-h-dvh bg-[#f4f3f8] lg:grid lg:grid-cols-[15.5rem_1fr]">
      <aside className="no-print bg-night lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto">
        <div className="flex items-center gap-3 px-6 py-5">
          <Link href="/admin" aria-label="Dashboard"><Logo settings={settings} variant="dark" className="h-10" /></Link>
          <span className="text-[10px] font-bold uppercase leading-tight tracking-[0.16em] text-white/70">Admin<br />panel</span>
        </div>
        <AdminNav can={[...can]} />
      </aside>

      <div className="min-w-0">
        <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-white/95 px-4 backdrop-blur lg:px-8">
          <span className="badge badge-brand">{ROLE_LABEL[profile.role]}</span>
          <span className="hidden text-[13px] text-muted sm:inline">{profile.full_name}</span>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/" target="_blank" className="btn btn-ghost btn-sm"><Icon name="external" size={16} /> View shop</Link>
            <form action={signOut}>
              <button className="btn btn-outline btn-sm"><Icon name="logout" size={15} /> Sign out</button>
            </form>
          </div>
        </header>
        <main className="px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
