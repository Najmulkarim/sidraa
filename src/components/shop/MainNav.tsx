'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** The uppercase category bar under the header, with the current page underlined. */
export function MainNav({ links }: { links: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="hidden border-t border-line md:block">
      <ul className="container-page flex justify-center gap-8 overflow-x-auto [scrollbar-width:none]">
        {links.map((l) => {
          const active = l.href === '/' ? path === '/' : path === l.href || path.startsWith(`${l.href}/`);
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={active ? 'page' : undefined}
                className={`relative block whitespace-nowrap py-3 text-[12.5px] font-medium uppercase tracking-[0.04em] transition-colors hover:text-brand ${
                  active ? 'text-brand after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brand' : 'text-ink'
                }`}
              >
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
