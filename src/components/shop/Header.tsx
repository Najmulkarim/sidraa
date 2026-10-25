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
export function Header({ settings, categories, zones, theme = 'luxora' }: { settings: StoreSettings; categories: Category[]; zones: DeliveryZone[]; theme?: string }) {
  const cream = theme === 'luxora';
  // The shop's own announcement (Settings → Store) replaces the automatic one.
  const freeOver = zones.map((z) => (z.free_over === null ? null : Number(z.free_over))).filter((n): n is number => n !== null);
  const announce = settings.announcement ?? [
    'Cash on delivery all over Bangladesh',
    freeOver.length ? `Free delivery on orders over ${formatTaka(Math.min(...freeOver))}` : null,
    `Easy ${settings.return_policy_days}-day returns`,
  ].filter(Boolean).join('  •  ');
  const links = [
    { href: '/', label: 'Home' },
    { href: '/products', label: 'Shop all' },
    ...categories.slice(0, 6).map((c) => ({ href: `/category/${c.slug}`, label: c.name })),
    { href: '/track', label: 'Track order' },
  ];
  // The centred menu: Home, New arrivals and the first four categories.
  const barLinks = [
    { href: '/', label: 'Home' },
    { href: '/products?sort=new', label: 'New arrivals' },
    ...(categories.length ? categories.slice(0, 4).map((c) => ({ href: `/category/${c.slug}`, label: c.name })) : [{ href: '/products', label: 'Shop all' }]),
  ];
  const tel = settings.phone ? settings.phone.replace(/[^\d+]/g, '') : null;
  const icon = 'grid h-10 w-10 place-items-center rounded-full text-night transition hover:bg-white/70 hover:text-brand';

  return (
    <>
      {announce && (
        /* One scrolling line on phones (the copy is doubled for a seamless loop), centred text from tablets up. */
        <div className="overflow-hidden bg-night py-2 text-[11.5px] uppercase tracking-[0.2em] text-white/90">
          <p className="hidden px-4 text-center md:block">{announce}</p>
          <p className="flex w-max animate-[ticker_22s_linear_infinite] whitespace-nowrap motion-reduce:w-full motion-reduce:whitespace-normal motion-reduce:px-4 motion-reduce:text-center md:hidden">
            <span className="sr-only">{announce}</span>
            <span aria-hidden="true" className="px-6">{announce}</span>
            <span aria-hidden="true" className="px-6 motion-reduce:hidden">{announce}</span>
          </p>
        </div>
      )}
      {/* One row: logo, category links, search, icons. The blur sits on a pseudo-element:
          backdrop-filter on the header itself would trap the drawer's position: fixed. */}
      {/* Logo left, menu centred, icons right, on the blush cream. The blur sits on a pseudo-element:
          backdrop-filter on the header itself would trap the drawer's position: fixed. */}
      <header className={`sticky top-0 z-30 shadow-[0_1px_0_color-mix(in_oklab,var(--brand)_10%,var(--line))] before:absolute before:inset-0 before:-z-10 ${cream ? 'before:bg-cream/95' : 'before:bg-paper/95'} before:backdrop-blur`}>
        <div className="container-page flex h-16 items-center gap-2 md:h-[76px]">
          <MobileMenu links={links} logo={<Logo settings={settings} className="h-9" />} />

          <Link href="/" className="flex shrink-0 items-center" aria-label={`${settings.store_name} home`}>
            <Logo settings={settings} className="h-10 md:h-11" />
          </Link>

          <div className="mx-auto hidden self-stretch lg:block"><MainNav links={barLinks} look={theme === 'luxe' ? 'pill' : theme === 'novatrend' ? 'color' : 'underline'} /></div>

          <div className="ml-auto flex items-center gap-0.5 lg:ml-0 lg:gap-1.5">
            {/* Search opens a small box under the icon (works without JavaScript). */}
            <details className="group relative">
              <summary className={`${icon} cursor-pointer list-none [&::-webkit-details-marker]:hidden`} aria-label="Search">
                <Icon name="search" size={20} />
              </summary>
              <form action="/products" role="search" className="absolute right-0 top-12 z-40 flex w-[min(20rem,calc(100vw-2rem))] animate-[fade-in_0.2s_ease-out] overflow-hidden rounded-md bg-card shadow-xl ring-1 ring-line">
                <label htmlFor="site-search" className="sr-only">Search products</label>
                <input id="site-search" name="q" type="search" placeholder="Search products…" maxLength={80} autoFocus className="min-w-0 flex-1 bg-transparent px-4 py-3 text-[15px] outline-none" />
                <button className="bg-night px-4 text-white hover:bg-brand" aria-label="Search"><Icon name="search" size={18} /></button>
              </form>
            </details>
            <Link href="/track" className={icon} aria-label="Track your order" title="Track order">
              <Icon name="truck" size={21} />
            </Link>
            {tel && (
              <a href={`tel:${tel}`} className={`${icon} max-sm:hidden`} aria-label={`Call ${settings.phone}`} title="Call us">
                <Icon name="phone" size={19} />
              </a>
            )}
            <CartBadge />
            {theme === 'shopease' && <Link href="/products" className="btn btn-sm ml-2 hidden bg-brand text-white hover:bg-night sm:inline-flex">Shop now</Link>}
          </div>
        </div>
      </header>
    </>
  );
}
