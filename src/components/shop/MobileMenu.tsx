'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from '../icons';

/**
 * Phone menu: a drawer that slides in from the left over a dimmed page.
 * Still a <details> element, so it opens before JavaScript loads; tapping
 * the dimmed page closes it (the backdrop is the <summary>'s ::before).
 * With JavaScript it also closes on navigation and Escape, and stops the
 * page behind it from scrolling.
 */
export function MobileMenu({ links, logo }: { links: { href: string; label: string }[]; logo: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const path = usePathname();

  const close = () => {
    if (ref.current) ref.current.open = false;
  };

  useEffect(close, [path]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onToggle = () => {
      document.documentElement.style.overflow = el.open ? 'hidden' : '';
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    el.addEventListener('toggle', onToggle);
    document.addEventListener('keydown', onKey);
    return () => {
      el.removeEventListener('toggle', onToggle);
      document.removeEventListener('keydown', onKey);
      document.documentElement.style.overflow = '';
    };
  }, []);

  return (
    <details ref={ref} className="group md:hidden">
      <summary
        className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-full transition active:scale-90 hover:bg-tint group-open:before:fixed group-open:before:inset-0 group-open:before:z-40 group-open:before:animate-[fade-in_0.25s_ease-out] group-open:before:bg-night/55 group-open:before:backdrop-blur-[2px] [&::-webkit-details-marker]:hidden"
        aria-label="Menu"
      >
        <Icon name="menu" size={22} />
      </summary>
      <nav className="fixed inset-y-0 left-0 z-50 flex w-[84%] max-w-xs animate-[drawer-in_0.3s_cubic-bezier(0.2,0.8,0.2,1)] flex-col overflow-y-auto bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          {logo}
          <button type="button" onClick={close} className="grid h-10 w-10 place-items-center rounded-full transition active:scale-90 hover:bg-tint" aria-label="Close menu">
            <Icon name="x" size={20} />
          </button>
        </div>
        <form action="/products" role="search" className="m-4 flex overflow-hidden rounded-full border-[1.5px] border-[color-mix(in_oklab,var(--brand)_25%,white)]">
          <label htmlFor="drawer-search" className="sr-only">Search products</label>
          <input id="drawer-search" name="q" type="search" placeholder="Search products…" maxLength={80} className="min-w-0 flex-1 bg-transparent px-4 py-2.5 text-base outline-none" />
          <button className="grid w-12 place-items-center bg-[linear-gradient(120deg,var(--accent),var(--brand))] text-white" aria-label="Search">
            <Icon name="search" size={18} />
          </button>
        </form>
        <ul className="px-2 pb-6">
          {links.map((l, i) => {
            const active = l.href === '/' ? path === '/' : path === l.href || path.startsWith(`${l.href}/`);
            return (
              <li key={l.href} className="animate-[drawer-in_0.35s_cubic-bezier(0.2,0.8,0.2,1)_both]" style={{ animationDelay: `${60 + i * 35}ms` }}>
                <Link
                  href={l.href}
                  onClick={close}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center justify-between rounded-xl px-3 py-3 text-[15px] font-medium transition active:scale-[0.98] ${active ? 'bg-tint text-brand' : 'hover:bg-tint hover:text-brand'}`}
                >
                  {l.label}
                  <Icon name="arrow" size={16} className="opacity-40" />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </details>
  );
}
