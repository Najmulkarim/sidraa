'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import type { Capability } from '@/lib/permissions';
import { Icon, type IconName } from '../icons';

/** need: any one of these capabilities shows the link. tone: badge colour. */
type Item = { href: string; label: string; icon: IconName; exact?: boolean; need?: Capability[]; tone?: 'brand' | 'warn' };

const GROUPS: { title: string; items: Item[] }[] = [
  { title: 'Overview', items: [{ href: '/admin', label: 'Dashboard', icon: 'grid', exact: true }] },
  {
    title: 'Sales',
    items: [
      { href: '/admin/orders', label: 'Orders', icon: 'cart', need: ['orders'], tone: 'brand' },
      { href: '/admin/customers', label: 'Customers', icon: 'users', need: ['customers'] },
      { href: '/admin/coupons', label: 'Coupons', icon: 'ticket', need: ['catalog'] },
      { href: '/admin/reports', label: 'Reports', icon: 'chart', need: ['revenue'] },
      { href: '/admin/accounting', label: 'Accounting', icon: 'cash', need: ['revenue'] },
    ],
  },
  {
    title: 'Catalog',
    items: [
      { href: '/admin/products', label: 'Products', icon: 'box', need: ['catalog'] },
      { href: '/admin/categories', label: 'Categories', icon: 'tag', need: ['catalog'] },
      { href: '/admin/reviews', label: 'Reviews', icon: 'star', need: ['catalog'], tone: 'brand' },
      { href: '/admin/inventory', label: 'Inventory', icon: 'layers', need: ['inventory'], tone: 'warn' },
    ],
  },
];

/** Kept at the bottom of the sidebar: set-up pages used now and then. */
const STORE: Item[] = [
  { href: '/admin/homepage', label: 'Homepage', icon: 'home', need: ['store_settings'] },
  { href: '/admin/settings', label: 'Settings', icon: 'settings', need: ['store_settings', 'courier_settings', 'marketing', 'staff'] },
  { href: '/admin/account', label: 'My account', icon: 'user' },
];

const BADGE_TITLE: Record<string, string> = { '/admin/orders': 'new orders waiting', '/admin/inventory': 'variants running low', '/admin/reviews': 'reviews waiting for approval' };

export function AdminNav({ can, badges = {}, user }: { can: Capability[]; badges?: Record<string, number>; user: { name: string; role: string } }) {
  const path = usePathname();
  const has = new Set(can);
  const nav = useRef<HTMLElement>(null);
  const visible = (i: Item) => !i.need || i.need.some((n) => has.has(n));

  // Phones show the menu as one sliding row: keep the open page's link in view.
  useEffect(() => {
    nav.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [path]);

  const link = (l: Item) => {
    const active = l.exact ? path === l.href : path === l.href || path.startsWith(`${l.href}/`);
    const count = badges[l.href] ?? 0;
    return (
      <Link
        key={l.href}
        href={l.href}
        aria-current={active ? 'page' : undefined}
        className={`group relative flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition ${
          active ? 'bg-[linear-gradient(105deg,var(--brand),var(--plum))] text-white shadow-[0_8px_20px_-10px_var(--brand)]' : 'text-white/75 hover:bg-white/8 hover:text-white'
        }`}
      >
        <Icon name={l.icon} size={18} className={active ? '' : 'transition group-hover:scale-110'} />
        {l.label}
        {count > 0 && (
          <span
            title={`${count} ${BADGE_TITLE[l.href] ?? ''}`}
            className={`ml-auto grid min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold leading-5 tabular-nums ${
              active ? 'bg-white text-brand-ink' : l.tone === 'warn' ? 'bg-warn text-white' : 'bg-brand text-white'
            }`}
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </Link>
    );
  };

  const store = STORE.filter(visible);

  return (
    <nav ref={nav} aria-label="Admin" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:gap-5 lg:overflow-visible lg:pb-4">
      {GROUPS.map((g) => {
        const items = g.items.filter(visible);
        if (items.length === 0) return null;
        return (
          <div key={g.title} className="flex gap-1 lg:flex-col">
            <p className="hidden px-3 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/40 lg:block">{g.title}</p>
            {items.map(link)}
          </div>
        );
      })}

      {/* Store set-up sits at the bottom, under the signed-in person. */}
      <div className="flex gap-1 lg:mt-auto lg:flex-col lg:border-t lg:border-white/10 lg:pt-4">
        <p className="hidden px-3 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/40 lg:block">Store</p>
        {store.map(link)}
        <div className="mt-3 hidden items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5 lg:flex">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,var(--brand),var(--plum))] text-[13px] font-bold text-white">
            {user.name.trim().charAt(0).toUpperCase() || '?'}
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[13px] font-semibold text-white">{user.name}</span>
            <span className="block truncate text-[11.5px] text-white/50">{user.role}</span>
          </span>
        </div>
      </div>
    </nav>
  );
}
