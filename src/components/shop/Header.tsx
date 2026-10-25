import Link from 'next/link';
import { imageUrl } from '@/lib/env';
import { formatTaka } from '@/lib/format';
import { parseStorefront } from '@/lib/storefront';
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
  const cream = theme === 'luxora' || theme === 'chic';
  // Settings → Storefront: which header parts show.
  const show = parseStorefront(settings.storefront).header;
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
    ...categories.slice(0, 4).map((c) => ({ href: `/category/${c.slug}`, label: c.name })),
    // With only a few categories the menu also offers the whole shop.
    ...(categories.length < 4 ? [{ href: '/products', label: 'Shop all' }] : []),
  ];
  const tel = settings.phone ? settings.phone.replace(/[^\d+]/g, '') : null;
  const icon = 'grid h-10 w-10 place-items-center rounded-full text-night transition hover:bg-white/70 hover:text-brand';

  // Market theme: help links on top, a big search box with a category picker, the phone number, and a category bar.
  if (theme === 'market' || theme === 'mega' || theme === 'topdeal') {
    const dark = theme === 'mega' || theme === 'topdeal';
    const bar = [{ href: '/', label: 'Home' }, { href: '/products', label: 'Shop all' }, { href: '/products?sort=new', label: 'New arrivals' }, ...categories.slice(0, 8).map((c) => ({ href: `/category/${c.slug}`, label: c.name }))];
    return (
      <>
        {show.announcement && announce && (
          <div className="bg-night text-[12px] text-white/85">
            <div className="container-page flex h-9 items-center gap-4">
              <p className="truncate">{announce}</p>
              <nav className="ml-auto hidden shrink-0 gap-4 md:flex" aria-label="Help">
                <Link href="/track" className="hover:text-white">Track order</Link>
                <Link href="/info/delivery" className="hover:text-white">Delivery &amp; COD</Link>
                <Link href="/info/returns" className="hover:text-white">Returns</Link>
              </nav>
            </div>
          </div>
        )}
        <header className={`${show.sticky ? 'sticky top-0' : 'relative'} z-30 ${dark ? 'bg-night text-white' : 'bg-white shadow-[0_1px_0_var(--line)]'}`}>
          <div className="container-page flex h-16 items-center gap-2 md:h-[76px] md:gap-6">
            <span className={dark ? '[&_summary]:text-white' : ''}><MobileMenu links={links} logo={<Logo settings={settings} className="h-9" />} /></span>
            <Link href="/" className="flex shrink-0 items-center" aria-label={`${settings.store_name} home`}><Logo settings={settings} variant={dark ? 'dark' : 'light'} className="h-10 md:h-11" /></Link>
            {show.search && (
              <form action="/products" role="search" className="mx-auto hidden h-11 w-full max-w-xl overflow-hidden rounded-full border-[1.5px] border-brand/40 bg-white text-night focus-within:border-brand md:flex">
                <label htmlFor="mk-cat" className="sr-only">Category</label>
                <select id="mk-cat" name="category" defaultValue="" className="max-w-40 border-r border-line bg-soft px-3 text-[13px] font-semibold outline-none">
                  <option value="">All categories</option>
                  {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
                </select>
                <label htmlFor="mk-q" className="sr-only">Search products</label>
                <input id="mk-q" name="q" type="search" placeholder="Search products…" maxLength={80} className="min-w-0 flex-1 px-4 text-[14px] outline-none" />
                <button className="bg-brand px-5 text-white hover:bg-night" aria-label="Search"><Icon name="search" size={18} /></button>
              </form>
            )}
            <div className="ml-auto flex items-center gap-1 md:ml-0">
              {show.call && tel && (
                <a href={`tel:${tel}`} className="mr-2 hidden items-center gap-2 lg:flex">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-tint text-brand"><Icon name="phone" size={18} /></span>
                  <span className="leading-tight"><b className={`block text-[14px] ${dark ? 'text-white' : 'text-night'}`}>{settings.phone}</b><span className={`text-[11.5px] ${dark ? 'text-white/60' : 'text-muted'}`}>Hotline · call to order</span></span>
                </a>
              )}
              {show.track && <Link href="/track" className={dark ? 'grid h-10 w-10 place-items-center rounded-full text-white hover:bg-white/10' : icon} aria-label="Track your order" title="Track order"><Icon name="truck" size={21} /></Link>}
              <span className={dark ? 'rounded-full bg-white' : ''}><CartBadge /></span>
            </div>
          </div>
          {show.search && (
            <form action="/products" role="search" className="container-page flex pb-3 md:hidden">
              <label htmlFor="mk-q-m" className="sr-only">Search products</label>
              <input id="mk-q-m" name="q" type="search" placeholder="Search products…" maxLength={80} className="h-10 min-w-0 flex-1 rounded-l-full border-[1.5px] border-r-0 border-brand/40 bg-white px-4 text-[14px] text-night outline-none focus:border-brand" />
              <button className="rounded-r-full bg-brand px-4 text-white" aria-label="Search"><Icon name="search" size={17} /></button>
            </form>
          )}
          {show.menu && (
            <nav className={`hidden md:block ${dark ? 'border-t border-white/10 bg-night text-white' : 'bg-brand text-white'}`} aria-label="Categories">
              <ul className="container-page flex h-11 items-center gap-6 overflow-x-auto text-[13.5px] font-semibold [scrollbar-width:none]">
                {bar.map((l) => <li key={l.href} className="shrink-0"><Link href={l.href} className="opacity-90 hover:opacity-100 hover:underline">{l.label}</Link></li>)}
              </ul>
            </nav>
          )}
        </header>
      </>
    );
  }

  return (
    <>
      {show.announcement && announce && (
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
      <header className={`${show.sticky ? 'sticky top-0' : 'relative'} z-30 shadow-[0_1px_0_color-mix(in_oklab,var(--brand)_10%,var(--line))] before:absolute before:inset-0 before:-z-10 ${cream ? 'before:bg-cream/95' : 'before:bg-paper/95'} before:backdrop-blur`}>
        <div className="container-page flex h-16 items-center gap-2 md:h-[76px]">
          <MobileMenu links={links} logo={<Logo settings={settings} className="h-9" />} />

          <Link href="/" className="flex shrink-0 items-center" aria-label={`${settings.store_name} home`}>
            <Logo settings={settings} className="h-10 md:h-11" />
          </Link>

          <div className={`mx-auto hidden self-stretch ${show.menu ? 'lg:block' : ''}`}><MainNav links={barLinks} look={theme === 'luxe' ? 'pill' : theme === 'novatrend' ? 'color' : 'underline'} /></div>

          <div className="ml-auto flex items-center gap-0.5 lg:ml-0 lg:gap-1.5">
            {/* Search opens a small box under the icon (works without JavaScript). */}
            {show.search && <details className="group relative">
              <summary className={`${icon} cursor-pointer list-none [&::-webkit-details-marker]:hidden`} aria-label="Search">
                <Icon name="search" size={20} />
              </summary>
              <form action="/products" role="search" className="absolute right-0 top-12 z-40 flex w-[min(20rem,calc(100vw-2rem))] animate-[fade-in_0.2s_ease-out] overflow-hidden rounded-md bg-card shadow-xl ring-1 ring-line">
                <label htmlFor="site-search" className="sr-only">Search products</label>
                <input id="site-search" name="q" type="search" placeholder="Search products…" maxLength={80} autoFocus className="min-w-0 flex-1 bg-transparent px-4 py-3 text-[15px] outline-none" />
                <button className="bg-night px-4 text-white hover:bg-brand" aria-label="Search"><Icon name="search" size={18} /></button>
              </form>
            </details>}
            {show.track && <Link href="/track" className={icon} aria-label="Track your order" title="Track order">
              <Icon name="truck" size={21} />
            </Link>}
            {show.call && tel && (
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
