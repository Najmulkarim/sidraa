'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Capability } from '@/lib/permissions';
import { Icon, type IconName } from '../icons';

/** need: any one of these capabilities shows the link. */
type Item = { href: string; label: string; icon: IconName; exact?: boolean; need?: Capability[] };

const GROUPS: { title: string; items: Item[] }[] = [
  { title: 'Overview', items: [{ href: '/admin', label: 'Dashboard', icon: 'grid', exact: true }] },
  {
    title: 'Sales',
    items: [
      { href: '/admin/orders', label: 'Orders', icon: 'cart', need: ['orders'] },
      { href: '/admin/customers', label: 'Customers', icon: 'users', need: ['customers'] },
      { href: '/admin/coupons', label: 'Coupons', icon: 'ticket', need: ['catalog'] },
      { href: '/admin/reports', label: 'Reports', icon: 'chart', need: ['revenue'] },
    ],
  },
  {
    title: 'Catalog',
    items: [
      { href: '/admin/products', label: 'Products', icon: 'box', need: ['catalog'] },
      { href: '/admin/categories', label: 'Categories', icon: 'tag', need: ['catalog'] },
      { href: '/admin/inventory', label: 'Inventory', icon: 'layers', need: ['inventory'] },
    ],
  },
  {
    title: 'Store',
    items: [
      { href: '/admin/settings', label: 'Settings', icon: 'settings', need: ['store_settings', 'courier_settings', 'marketing', 'staff'] },
      { href: '/admin/account', label: 'My account', icon: 'user' },
    ],
  },
];

export function AdminNav({ can }: { can: Capability[] }) {
  const path = usePathname();
  const has = new Set(can);
  return (
    <nav aria-label="Admin" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:gap-5 lg:overflow-visible lg:pb-6">
      {GROUPS.map((g) => {
        const items = g.items.filter((i) => !i.need || i.need.some((n) => has.has(n)));
        if (items.length === 0) return null;
        return (
          <div key={g.title} className="flex gap-1 lg:flex-col">
            <p className="hidden px-3 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/40 lg:block">{g.title}</p>
            {items.map((l) => {
              const active = l.exact ? path === l.href : path === l.href || path.startsWith(`${l.href}/`);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition ${
                    active ? 'bg-[linear-gradient(105deg,var(--brand),var(--plum))] text-white shadow-[0_8px_20px_-10px_var(--brand)]' : 'text-white/75 hover:bg-white/8 hover:text-white'
                  }`}
                >
                  <Icon name={l.icon} size={18} />
                  {l.label}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
