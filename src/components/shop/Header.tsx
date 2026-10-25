import Link from 'next/link';
import { imageUrl } from '@/lib/env';
import { formatTaka } from '@/lib/format';
import type { Category, DeliveryZone, StoreSettings } from '@/lib/types';
import { Icon } from '../icons';
import { CartBadge } from './CartBadge';
import { MainNav } from './MainNav';
import { MobileMenu } from './MobileMenu';

export function Logo({ settings, variant = 'light', className = 'h-11' }: { settings: StoreSettings; variant?: 'light' | 'dark'; className?: string }) {
  // The seeded logo has a version for dark backgrounds next to it (logo-dark.png).
  const path = settings.logo_path && variant === 'dark' ? settings.logo_path.replace('logo-light', 'logo-dark') : settings.logo_path;
  const src = imageUrl(path);
  if (src) return <img src={src} alt={settings.store_name} className={`${className} w-auto object-contain`} />;
  return (
    <span className="flex flex-col leading-none">
      <span className={`text-[28px] font-bold tracking-wide ${variant === 'dark' ? 'text-white' : 'text-grad'}`}>{settings.store_name}</span>
      {settings.tagline && <span className={`mt-1 text-[9px] font-semibold uppercase tracking-[0.3em] ${variant === 'dark' ? 'text-white/70' : 'text-night'}`}>{settings.tagline}</span>}
    </span>
  );
}

/** Server component. The mobile menu (MobileMenu) is a <details> element, so it works before JavaScript loads. */
export function Header({ settings, categories, zones }: { settings: StoreSettings; categories: Category[]; zones: DeliveryZone[] }) {
  const freeOver = zones.map((z) => (z.free_over === null ? null : Number(z.free_over))).filter((n): n is number => n !== null);
  // The shop's own announcement (Settings → Store) replaces the automatic one.
  const announce = settings.announcement ? [settings.announcement] : [
    'Cash on delivery all over Bangladesh',
    freeOver.length ? `Free delivery on orders over ${formatTaka(Math.min(...freeOver))}` : null,
    `Easy ${settings.return_policy_days}-day returns`,
  ].filter(Boolean);
  const links = [
    { href: '/', label: 'Home' },
    { href: '/products', label: 'Shop all' },
    ...categories.slice(0, 6).map((c) => ({ href: `/category/${c.slug}`, label: c.name })),
    { href: '/track', label: 'Track order' },
  ];

  return (
    <>
      {/* One scrolling line on phones (the copy is doubled for a seamless loop), centred text from tablets up. */}
      <div className="overflow-hidden bg-night py-2 text-[12px] tracking-wide text-white/90">
        <p className="hidden px-4 text-center md:block">{announce.join('  •  ')}</p>
        <p className="flex w-max animate-[ticker_22s_linear_infinite] whitespace-nowrap motion-reduce:w-full motion-reduce:whitespace-normal motion-reduce:px-4 motion-reduce:text-center md:hidden">
          <span className="sr-only">{announce.join('. ')}</span>
          <span aria-hidden="true" className="px-6">{announce.join('  •  ')}</span>
          <span aria-hidden="true" className="px-6 motion-reduce:hidden">{announce.join('  •  ')}</span>
        </p>
      </div>
      {/* The blur sits on a pseudo-element: backdrop-filter on the header itself would trap the drawer's position: fixed. */}
      <header className="sticky top-0 z-30 shadow-[0_1px_0_var(--line)] before:absolute before:inset-0 before:-z-10 before:bg-paper/95 before:backdrop-blur">
        <div className="container-page flex h-16 items-center gap-3 md:h-[72px] md:gap-8">
          <MobileMenu links={links} logo={<Logo settings={settings} className="h-9" />} />

          <Link href="/" className="flex shrink-0 items-center" aria-label={`${settings.store_name} home`}>
            <Logo settings={settings} className="h-10 md:h-12" />
          </Link>

          <form action="/products" role="search" className="mx-auto hidden max-w-xl flex-1 overflow-hidden rounded-full border-[1.5px] border-[color-mix(in_oklab,var(--brand)_25%,white)] md:flex">
            <label htmlFor="site-search" className="sr-only">Search products</label>
            <input id="site-search" name="q" type="search" placeholder="Search for products, styles and more…" maxLength={80} className="min-w-0 flex-1 bg-transparent px-5 py-2.5 text-[13px] outline-none" />
            <button className="grid w-14 place-items-center bg-[linear-gradient(120deg,var(--accent),var(--brand))] text-white" aria-label="Search">
              <Icon name="search" size={19} />
            </button>
          </form>

          <div className="ml-auto flex items-center gap-4 md:ml-0 md:gap-6">
            <Link href="/products" className="flex flex-col items-center gap-0.5 text-ink hover:text-brand md:hidden" aria-label="Search">
              <Icon name="search" size={22} />
            </Link>
            <Link href="/track" className="flex flex-col items-center gap-0.5 text-ink hover:text-brand" aria-label="Track your order">
              <Icon name="truck" size={23} />
              <span className="hidden text-[11px] text-muted sm:block">Track</span>
            </Link>
            <CartBadge />
          </div>
        </div>
        <MainNav links={links} />
      </header>
    </>
  );
}
