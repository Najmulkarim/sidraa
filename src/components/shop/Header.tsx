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
  // The bar next to the logo: the first five categories, or "Shop all" when there are none.
  const barLinks = categories.length
    ? categories.slice(0, 5).map((c) => ({ href: `/category/${c.slug}`, label: c.name }))
    : [{ href: '/products', label: 'Shop all' }];
  const tel = settings.phone ? settings.phone.replace(/[^\d+]/g, '') : null;

  return (
    <>
      {announce && (
        /* One scrolling line on phones (the copy is doubled for a seamless loop), centred text from tablets up. */
        <div className="overflow-hidden bg-night py-2 text-[12px] tracking-wide text-white/90">
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
      <header className="sticky top-0 z-30 shadow-[0_1px_8px_-2px_rgba(20,14,30,0.12)] before:absolute before:inset-0 before:-z-10 before:bg-paper/95 before:backdrop-blur">
        <div className="container-page flex h-16 items-center gap-3 md:h-[72px] lg:gap-8">
          <MobileMenu links={links} logo={<Logo settings={settings} className="h-9" />} />

          <Link href="/" className="flex shrink-0 items-center" aria-label={`${settings.store_name} home`}>
            <Logo settings={settings} className="h-10 md:h-11" />
          </Link>

          <MainNav links={barLinks} />

          <form action="/products" role="search" className="ml-auto hidden h-10 w-full max-w-[19rem] items-center rounded-md bg-soft ring-1 ring-transparent transition focus-within:bg-card focus-within:ring-brand md:flex xl:max-w-[21rem]">
            <label htmlFor="site-search" className="sr-only">Search products</label>
            <input id="site-search" name="q" type="search" placeholder="Search" maxLength={80} className="min-w-0 flex-1 bg-transparent px-3.5 text-[13.5px] outline-none placeholder:text-muted" />
            <button className="grid h-full w-10 place-items-center text-muted hover:text-brand" aria-label="Search">
              <Icon name="search" size={18} />
            </button>
          </form>

          <div className="ml-auto flex items-center gap-4 md:ml-2 md:gap-5 lg:gap-7">
            <Link href="/products" className="flex flex-col items-center text-ink hover:text-brand md:hidden" aria-label="Search">
              <Icon name="search" size={22} />
            </Link>
            <Link href="/track" className="flex flex-col items-center gap-1 text-ink hover:text-brand" aria-label="Track your order">
              <Icon name="truck" size={22} />
              <span className="hidden text-[11.5px] font-semibold leading-none sm:block">Track</span>
            </Link>
            {tel && (
              <a href={`tel:${tel}`} className="hidden flex-col items-center gap-1 text-ink hover:text-brand sm:flex" aria-label={`Call ${settings.phone}`}>
                <Icon name="phone" size={21} />
                <span className="text-[11.5px] font-semibold leading-none">Call</span>
              </a>
            )}
            <CartBadge />
          </div>
        </div>
      </header>
    </>
  );
}
