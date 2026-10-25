'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** Category links in the header row, next to the logo (wide screens); the current one is underlined. */
export function MainNav({ links }: { links: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="h-full">
      <ul className="flex h-full items-stretch gap-6 xl:gap-7">
        {links.map((l) => {
          const active = l.href === '/' ? path === '/' : path === l.href || path.startsWith(`${l.href}/`);
          return (
            <li key={l.href} className="flex">
              <Link
                href={l.href}
                aria-current={active ? 'page' : undefined}
                className={`relative flex items-center whitespace-nowrap text-[13.5px] font-normal tracking-[0.04em] transition-colors hover:text-brand ${
                  active ? 'text-brand after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:rounded-t-full after:bg-brand' : 'text-ink'
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
