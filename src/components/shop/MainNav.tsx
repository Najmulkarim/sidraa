'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** Category links in the header row, next to the logo (wide screens); the current one is underlined. */
export function MainNav({ links, look = 'underline' }: { links: { href: string; label: string }[]; look?: 'underline' | 'pill' | 'color' }) {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="h-full">
      <ul className="flex h-full items-stretch gap-6 xl:gap-7">
        {links.map((l) => {
          const active = l.href === '/' ? path === '/' : path === l.href || path.startsWith(`${l.href}/`);
          return (
            <li key={l.href} className="flex items-center">
              <Link
                href={l.href}
                aria-current={active ? 'page' : undefined}
                className={`relative flex items-center whitespace-nowrap text-[14px] transition-colors ${
                  look === 'pill'
                    ? `h-9 rounded-full px-4 font-medium ${active ? 'bg-night text-white' : 'text-ink hover:bg-soft'}`
                    : look === 'color'
                      ? `h-full font-medium ${active ? 'text-brand' : 'text-ink hover:text-brand'}`
                      : `h-full tracking-[0.04em] hover:text-brand ${active ? 'text-brand after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:rounded-t-full after:bg-brand' : 'text-ink'}`
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
