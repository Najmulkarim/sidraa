import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon, type IconName } from '../../icons';
import { ProductImage } from '../ProductImage';
import { ProductRow } from '../ProductCard';
import { HeroSlider } from './HeroSlider';
import { priceRange, totalStock } from '@/lib/catalog';
import { imageUrl } from '@/lib/env';
import { formatTaka, toNumber } from '@/lib/format';
import type { SectionSettings } from '@/lib/home-sections';
import type { Category, ProductWithRelations, StoreSettings } from '@/lib/types';

/** Home page sections. Each is a server component fed by app/(shop)/page.tsx. */

export function SectionHead({ title, subtitle, href, linkLabel = 'View all' }: { title: string; subtitle?: string | null; href?: string | null; linkLabel?: string }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 className="font-display text-[1.6rem] uppercase leading-tight tracking-wide sm:text-[1.9rem]">{title}</h2>
        <span className="mt-1.5 block h-1 w-12 rounded-full bg-[linear-gradient(90deg,var(--brand),var(--accent))]" aria-hidden="true" />
        {subtitle && <p className="mt-2 text-[14px] text-muted">{subtitle}</p>}
      </div>
      {href && (
        <Link href={href} className="flex shrink-0 items-center gap-1 rounded-full border border-line px-3.5 py-1.5 text-[12.5px] font-semibold transition hover:border-brand hover:text-brand">
          {linkLabel} <Icon name="arrow" size={14} />
        </Link>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ hero

export function HeroSection({ title, subtitle, settings, store, discount, overlap }: {
  title: string | null; subtitle: string | null; settings: SectionSettings['hero']; store: StoreSettings; discount: number; overlap: boolean;
}) {
  const slides = settings.slides.filter((s) => s.image);
  if (slides.length > 0) return <HeroSlider slides={slides} />;
  // No photos yet: the brand gradient with the heading.
  return (
    <section className="relative overflow-hidden text-white" style={{ background: 'var(--hero)' }}>
      <span className="pointer-events-none absolute -left-24 top-10 h-72 w-72 animate-[float_9s_ease-in-out_infinite] rounded-full bg-accent/25 blur-3xl" aria-hidden="true" />
      <span className="pointer-events-none absolute -right-10 bottom-0 h-80 w-80 animate-[float_12s_ease-in-out_infinite_reverse] rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
      <div className={`container-page relative grid items-center gap-6 pt-10 md:grid-cols-[1.1fr_1fr] md:pt-14 ${overlap ? 'pb-24 md:pb-28' : 'pb-12 md:pb-16'}`}>
        <div className="relative z-10 space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-block rounded-full border border-white/70 bg-white/15 px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.12em]">{store.tagline ?? 'New season'}</span>
            {discount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[12px] font-bold uppercase text-brand shadow-lg md:hidden">
                <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand/60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-brand" /></span>
                Up to {discount}% off
              </span>
            )}
          </div>
          <h1 className="font-display text-[clamp(2.25rem,5.2vw,3.75rem)] font-medium leading-[1.08]">{title ?? store.store_name}</h1>
          {subtitle && <p className="max-w-sm text-[15px] text-white/90">{subtitle}</p>}
          <div className="flex flex-wrap gap-3">
            <Link href={settings.link || '/products'} className="btn btn-light">{settings.button || 'Shop now'}</Link>
            <Link href="/products?sort=new" className="btn btn-glass">Explore new in</Link>
          </div>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 pt-2 text-[12.5px]">
            {([['cash', 'Cash on delivery'], ['return', `${store.return_policy_days}-day returns`], ['shield', 'Check before you pay']] as [IconName, string][]).map(([icon, text]) => (
              <li key={text} className="flex items-center gap-2 font-medium"><Icon name={icon} size={17} /> {text}</li>
            ))}
          </ul>
        </div>
        <div className="relative mx-auto hidden w-full max-w-md md:block">
          <div className="relative mx-auto aspect-[4/5] w-[78%] overflow-hidden rounded-t-full bg-white/15 ring-1 ring-white/30">
            <img src="/demo/hero-1.svg" alt="" className="h-full w-full object-cover" />
          </div>
          {discount > 0 && (
            <span className="absolute right-0 top-10 grid h-28 w-28 place-items-center rounded-full bg-[radial-gradient(circle,var(--brand),var(--plum))] text-center font-bold leading-none shadow-xl ring-4 ring-white/80">
              <span><span className="block text-[11px] uppercase">Up to</span><span className="block text-[30px]">{discount}%</span><span className="block text-[11px] uppercase">off</span></span>
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------- quick links

export function QuickLinks({ settings }: { settings: SectionSettings['quick_links'] }) {
  const links = settings.links.filter((l) => l.label && l.href);
  if (!links.length) return null;
  return (
    <nav aria-label="Quick links" className="container-page mt-6">
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:justify-center md:px-0">
        {links.map((l, i) => (
          <li key={`${l.href}-${i}`} className="shrink-0">
            <Link href={l.href} className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold uppercase tracking-wide transition active:scale-95 ${i === 0 ? 'bg-[linear-gradient(105deg,var(--brand),var(--plum))] text-white shadow' : 'bg-card text-ink ring-1 ring-line hover:ring-brand hover:text-brand'}`}>
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// --------------------------------------------------------------- notice

export function Notice({ text, settings }: { text: string | null; settings: SectionSettings['notice'] }) {
  if (!text) return null;
  return (
    <div className="container-page mt-6">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl border border-[color-mix(in_oklab,var(--brand)_18%,white)] bg-tint px-4 py-3 text-[14px]">
        <Icon name="tag" size={18} className="shrink-0 text-brand" />
        <span className="flex-1">{text}</span>
        {settings.link && (
          <Link href={settings.link} className="inline-flex items-center gap-1 font-semibold text-brand-ink hover:underline">
            {settings.link_label || 'Learn more'} <Icon name="arrow" size={14} />
          </Link>
        )}
      </p>
    </div>
  );
}

// ------------------------------------------------------------- benefits

export function Benefits({ items, overlap }: { items: { icon: IconName; title: string; text: string; href: string; bg: string }[]; overlap: boolean }) {
  return (
    <section className={`container-page relative z-10 ${overlap ? '-mt-14' : 'mt-8'}`}>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {items.map((b) => (
          <li key={b.title}>
            <Link href={b.href} className="flex h-full items-center gap-3 rounded-xl p-4 text-white shadow-[var(--shadow)] transition hover:-translate-y-0.5 active:scale-[0.97]" style={{ background: b.bg }}>
              <span className="hidden h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/20 sm:grid"><Icon name={b.icon} size={22} /></span>
              <span className="min-w-0">
                <span className="block text-[13px] font-bold uppercase leading-tight">{b.title}</span>
                <span className="block text-[12px] text-white/85">{b.text}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ------------------------------------------------------- category tiles

export function CategoryTiles({ title, subtitle, categories }: { title: string | null; subtitle: string | null; categories: Category[] }) {
  if (!categories.length) return null;
  return (
    <section className="reveal container-page mt-12">
      <SectionHead title={title ?? 'Shop by category'} subtitle={subtitle} href="/products" />
      <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-3 lg:grid-cols-6">
        {categories.map((c) => {
          const src = imageUrl(c.image_path);
          return (
            <li key={c.id}>
              <Link href={`/category/${c.slug}`} className="group relative block aspect-square overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_30%_20%,white,var(--tint))] ring-1 ring-line transition active:scale-95">
                {src ? (
                  <img src={src} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                ) : (
                  <span className="grid h-full place-items-center pb-6 font-display text-4xl text-brand/50">{c.name[0]}</span>
                )}
                <span className="absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgba(20,14,30,0.72),transparent)] px-2 pb-2 pt-8 text-center text-[12.5px] font-semibold uppercase tracking-wide text-white">
                  {c.name}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ----------------------------------------------------------- collection

function Tile({ product, priority }: { product: ProductWithRelations; priority?: boolean }) {
  const { min } = priceRange(product);
  const compare = product.compare_at_price === null ? null : toNumber(product.compare_at_price);
  const off = compare !== null && compare > min ? Math.round((1 - min / compare) * 100) : 0;
  const soldOut = totalStock(product) <= 0;
  return (
    <Link href={`/product/${product.slug}`} className="group relative block aspect-square overflow-hidden rounded-xl bg-soft ring-1 ring-line transition active:scale-[0.98]" title={product.name}>
      <ProductImage path={product.images[0]?.storage_path} alt={product.name} sizes="(min-width: 1024px) 15vw, (min-width: 640px) 23vw, 48vw" priority={priority} className="transition duration-500 group-hover:scale-105" />
      {off > 0 && <span className="absolute left-2 top-2 rounded-md bg-brand px-1.5 py-0.5 text-[11px] font-bold text-white">−{off}%</span>}
      {soldOut && <span className="absolute right-2 top-2 rounded-md bg-night/80 px-1.5 py-0.5 text-[11px] font-bold uppercase text-white">Sold out</span>}
      <span className="absolute inset-x-0 bottom-0 translate-y-[calc(100%-2.1rem)] bg-[linear-gradient(0deg,rgba(20,14,30,0.85),rgba(20,14,30,0.55)_70%,transparent)] px-2.5 pb-2 pt-3 text-white transition-transform duration-300 group-hover:translate-y-0">
        <span className="flex items-baseline gap-1.5 text-[13px] font-bold">
          {formatTaka(min)}
          {off > 0 && <s className="text-[11px] font-normal text-white/70">{formatTaka(compare)}</s>}
        </span>
        <span className="mt-1 line-clamp-2 block text-[12px] leading-snug text-white/90">{product.name}</span>
      </span>
    </Link>
  );
}

export function Collection({ title, subtitle, settings, products }: { title: string | null; subtitle: string | null; settings: SectionSettings['collection']; products: ProductWithRelations[] }) {
  if (!products.length) return null;
  const heading = title ?? 'Collection';
  const more = settings.link || '/products';
  const feature = settings.image ?? products[0]?.images[0]?.storage_path ?? null;
  const shown = products.slice(0, settings.limit);
  return (
    <section className="reveal container-page mt-12">
      {/* 6 columns on wide screens: the feature takes 2×2, seven products + "View more" fill the other 4×2. */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3 lg:grid-cols-6">
        <Link href={more} className="group relative col-span-2 row-span-2 block min-h-72 overflow-hidden rounded-2xl bg-night">
          <ProductImage path={feature} alt="" sizes="(min-width: 1024px) 40vw, 100vw" className="opacity-90 transition duration-700 group-hover:scale-105" />
          <span className="absolute inset-0 flex flex-col justify-end bg-[linear-gradient(0deg,rgba(20,14,30,0.85),rgba(20,14,30,0.15)_55%,transparent)] p-5 text-white sm:p-7">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">Collection</span>
            <span className="mt-1 font-display text-[clamp(1.6rem,3.2vw,2.4rem)] font-semibold leading-tight">{heading}</span>
            {subtitle && <span className="mt-1 max-w-sm text-[14px] text-white/85">{subtitle}</span>}
            <span className="mt-4 inline-flex w-fit items-center gap-2 rounded-full bg-white px-4 py-2 text-[12.5px] font-bold uppercase text-brand transition group-hover:gap-3">
              Shop the collection <Icon name="arrow" size={15} />
            </span>
          </span>
        </Link>
        {shown.map((p, i) => <Tile key={p.id} product={p} priority={i < 2} />)}
        <Link href={more} className="group relative grid aspect-square place-items-center overflow-hidden rounded-xl bg-[linear-gradient(135deg,var(--plum),var(--brand))] text-center text-white ring-1 ring-line">
          {products[shown.length]?.images[0] && (
            <ProductImage path={products[shown.length]!.images[0]!.storage_path} alt="" sizes="20vw" className="opacity-25 blur-[2px]" />
          )}
          <span className="relative text-[15px] font-bold uppercase leading-tight tracking-wide">
            View<br />more
            <Icon name="arrow" size={18} className="mx-auto mt-2 transition group-hover:translate-x-1" />
          </span>
        </Link>
      </div>
    </section>
  );
}

// ---------------------------------------------------------- product row

export function ProductRowSection({ title, subtitle, settings, products, badge }: { title: string | null; subtitle: string | null; settings: SectionSettings['product_row']; products: ProductWithRelations[]; badge?: string }) {
  if (!products.length) return null;
  return (
    <section className="reveal container-page mt-12">
      <SectionHead title={title ?? 'Products'} subtitle={subtitle} href={settings.link || '/products'} />
      <ProductRow products={products} badge={badge} />
    </section>
  );
}

// -------------------------------------------------------------- banners

export function Banners({ settings }: { settings: SectionSettings['banners'] }) {
  const items = settings.items.filter((b) => b.image);
  if (!items.length) return null;
  const cols = items.length === 1 ? '' : items.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3';
  return (
    <section className={`reveal container-page mt-12 grid gap-3 ${cols}`}>
      {items.map((b, i) => {
        const inner: ReactNode = (
          <>
            <ProductImage path={b.image} alt={b.title || 'Banner'} sizes={items.length === 1 ? '100vw' : '(min-width: 768px) 33vw, 100vw'} className="transition duration-500 group-hover:scale-105" />
            {(b.title || b.subtitle) && (
              <span className="absolute inset-0 flex flex-col justify-end bg-[linear-gradient(0deg,rgba(20,14,30,0.7),transparent_65%)] p-5 text-white">
                {b.title && <span className="text-[20px] font-bold uppercase leading-tight">{b.title}</span>}
                {b.subtitle && <span className="text-[13px] text-white/85">{b.subtitle}</span>}
                {b.link && <span className="mt-2 inline-flex w-fit items-center gap-1 text-[12px] font-bold uppercase underline-offset-4 group-hover:underline">Shop now <Icon name="arrow" size={13} /></span>}
              </span>
            )}
          </>
        );
        const cls = `group relative block overflow-hidden rounded-2xl bg-soft ${items.length === 1 ? 'aspect-[16/6]' : 'aspect-[16/9]'}`;
        return b.link ? <Link key={i} href={b.link} className={cls}>{inner}</Link> : <div key={i} className={cls}>{inner}</div>;
      })}
    </section>
  );
}

// ---------------------------------------------------------------- about

export function About({ title, text, settings, store }: { title: string | null; text: string | null; settings: SectionSettings['about']; store: StoreSettings }) {
  if (!title && !text) return null;
  return (
    <section className="reveal container-page mt-14">
      <div className="grid items-center gap-6 overflow-hidden rounded-3xl bg-soft p-6 ring-1 ring-line md:grid-cols-[1.2fr_1fr] md:p-10">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-brand">{store.store_name}</p>
          {title && <h2 className="mt-2 font-display text-[clamp(1.6rem,3vw,2.3rem)] font-semibold leading-tight">{title}</h2>}
          {text && <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-ink/80">{text}</p>}
          {settings.link && (
            <Link href={settings.link} className="btn btn-outline mt-5">{settings.link_label || 'Learn more'}</Link>
          )}
        </div>
        {settings.image ? (
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
            <ProductImage path={settings.image} alt="" sizes="(min-width: 768px) 40vw, 100vw" />
          </div>
        ) : (
          <div className="hidden h-full min-h-40 rounded-2xl md:block" style={{ background: 'var(--grad)' }} aria-hidden="true" />
        )}
      </div>
    </section>
  );
}
