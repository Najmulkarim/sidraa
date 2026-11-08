import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { signOut } from '@/actions/auth';
import { AdminNav } from '@/components/admin/AdminNav';
import { NavToggle } from '@/components/admin/NavToggle';
import { NAV_COOKIE } from '@/lib/admin-nav';
import { Toaster } from '@/components/admin/Toaster';
import { Icon } from '@/components/icons';
import { Logo } from '@/components/shop/Header';
import { requireAdmin } from '@/lib/auth';
import { getSettings } from '@/lib/catalog';
import { ROLE_LABEL, type Capability } from '@/lib/permissions';

export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s · Admin' },
  robots: { index: false, follow: false },
};

/** Small counts shown next to menu links: orders waiting for a call, units in stock. */
async function navBadges(supabase: Awaited<ReturnType<typeof requireAdmin>>['supabase'], can: Set<Capability>): Promise<Record<string, number>> {
  const [pending, units, reviews, incomplete] = await Promise.all([
    can.has('orders') ? supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending').is('deleted_at', null) : null,
    can.has('inventory')
      // Every unit in stock (below-zero counts as none), products not archived.
      ? supabase.from('product_variants').select('stock, product:products!inner(status)').neq('product.status', 'archived').gt('stock', 0).limit(10000)
          .then(({ data }) => ((data ?? []) as { stock: number }[]).reduce((n, v) => n + v.stock, 0))
      : null,
    can.has('catalog') ? supabase.from('product_reviews').select('id', { count: 'exact', head: true }).eq('status', 'pending') : null,
    can.has('orders') ? supabase.from('incomplete_orders').select('id', { count: 'exact', head: true }).eq('status', 'open') : null,
  ]);
  return { '/admin/orders': pending?.count ?? 0, '/admin/inventory': units ?? 0, '/admin/reviews': reviews?.count ?? 0, '/admin/incomplete': incomplete?.count ?? 0 };
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const [{ profile, can, supabase }, settings, jar] = await Promise.all([requireAdmin(), getSettings(), cookies()]);
  // Big screens: the menu can be folded to icons (NavToggle); remembered per browser.
  const mini = jar.get(NAV_COOKIE)?.value === 'mini';
  const badges = await navBadges(supabase, can);

  return (
    <div id="admin-shell" data-nav={mini ? 'mini' : 'full'} className="group/shell min-h-dvh bg-[#f4f3f8] lg:grid lg:grid-cols-[15.5rem_1fr] lg:data-[nav=mini]:grid-cols-[4.5rem_1fr]">
      <aside className="no-print bg-night lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:overflow-y-auto">
        <div className="flex items-center gap-3 px-6 py-5 lg:py-4 lg:group-data-[nav=mini]/shell:justify-center lg:group-data-[nav=mini]/shell:px-2">
          <Link href="/admin" aria-label="Dashboard" className="lg:group-data-[nav=mini]/shell:hidden"><Logo settings={settings} variant="dark" className="h-10" /></Link>
          <span className="text-[10px] font-bold uppercase leading-tight tracking-[0.16em] text-white/70 lg:group-data-[nav=mini]/shell:hidden">Admin<br />panel</span>
          <Link href="/admin" aria-label="Dashboard" title={settings.store_name} className="hidden h-10 w-10 place-items-center rounded-xl bg-[linear-gradient(135deg,var(--brand),var(--plum))] text-lg font-bold text-white lg:group-data-[nav=mini]/shell:grid">{settings.store_name.trim().charAt(0).toUpperCase() || 'S'}</Link>
        </div>
        <AdminNav can={[...can]} badges={badges} user={{ name: profile.full_name, role: ROLE_LABEL[profile.role] }} />
      </aside>

      <div className="min-w-0">
        <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-white/95 px-4 backdrop-blur lg:px-8">
          <NavToggle initialMini={mini} />
          <span className="badge badge-brand">{ROLE_LABEL[profile.role]}</span>
          <span className="hidden text-[13px] text-muted sm:inline">{profile.full_name}</span>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/" target="_blank" className="btn btn-ghost btn-sm"><Icon name="external" size={16} /> View shop</Link>
            <form action={signOut}>
              <button className="btn btn-outline btn-sm"><Icon name="logout" size={15} /> Sign out</button>
            </form>
          </div>
        </header>
        <main className="px-4 py-6 lg:px-8 print:p-0">{children}</main>
        <Toaster />
      </div>
    </div>
  );
}
