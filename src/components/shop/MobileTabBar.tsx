'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Icon, type IconName } from '../icons';
import { CountBadge, useCartBump } from './CartBadge';
import { useCart } from './CartProvider';

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: '/', label: 'Home', icon: 'home' },
  { href: '/products', label: 'Shop', icon: 'grid' },
  { href: '/track', label: 'Track', icon: 'truck' },
  { href: '/cart', label: 'Cart', icon: 'bag' },
];

/**
 * App-style bottom navigation on phones. Slides away while scrolling down
 * and comes back on the way up. Product pages show their own buy bar in
 * this spot instead, and checkout keeps the screen to itself.
 */
export function MobileTabBar({ phone = null }: { phone?: string | null }) {
  const path = usePathname();
  const { count, ready } = useCart();
  const bump = useCartBump();
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (Math.abs(y - last) < 8) return;
      setHidden(y > last && y > 160);
      last = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setHidden(false), [path]);

  if (path === '/checkout') return null;
  const showBar = !path.startsWith('/product/');

  return (
    <>
      {/* Room at the bottom so the bar never covers the footer's last line. */}
      <div aria-hidden="true" className="h-[calc(4.25rem+env(safe-area-inset-bottom))] bg-night md:hidden" />
      {showBar && (
        <nav
          aria-label="Quick links"
          className={`fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-16px_var(--plum)] backdrop-blur transition-transform duration-300 md:hidden ${hidden ? 'translate-y-full' : ''}`}
        >
          <ul className={`grid ${phone ? 'grid-cols-5' : 'grid-cols-4'}`}>
            {TABS.map((t) => {
              const active = t.href === '/' ? path === '/' : path === t.href || path.startsWith(`${t.href}/`) || (t.href === '/products' && path.startsWith('/category/'));
              return (
                <li key={t.href}>
                  <Link
                    href={t.href}
                    aria-current={active ? 'page' : undefined}
                    className={`flex flex-col items-center gap-0.5 py-2 text-[12px] font-medium transition active:scale-90 ${active ? 'text-brand-ink' : 'text-muted'}`}
                  >
                    <span className={`relative grid h-8 w-14 place-items-center rounded-full transition-colors duration-300 ${active ? 'bg-tint' : ''}`}>
                      <Icon name={t.icon} size={22} strokeWidth={active ? 2.1 : 1.7} />
                      {t.href === '/cart' && ready && count > 0 && <CountBadge count={count} bump={bump} className="absolute right-1.5 -top-1" />}
                    </span>
                    {t.label}
                  </Link>
                </li>
              );
            })}
            {phone && (
              <li>
                <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="flex flex-col items-center gap-0.5 py-2 text-[12px] font-medium text-muted transition active:scale-90">
                  <span className="grid h-8 w-14 place-items-center rounded-full bg-ok/10 text-ok">
                    <Icon name="phone" size={21} />
                  </span>
                  Call
                </a>
              </li>
            )}
          </ul>
        </nav>
      )}
    </>
  );
}
