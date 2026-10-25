import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon, type IconName } from '../../icons';
import { ProductImage } from '../ProductImage';
import { AutoScroll } from './AutoScroll';
import { HeroLuxury, type HeroSlide } from './HeroLuxury';
import { TestimonialSlider } from './TestimonialSlider';
import { priceRange, totalStock } from '@/lib/catalog';
import { imageUrl } from '@/lib/env';
import { formatTaka, toNumber } from '@/lib/format';
import type { SectionSettings } from '@/lib/home-sections';
import type { Category, ProductWithRelations, StoreSettings } from '@/lib/types';

/** Home page sections (luxury layout). Each is fed by app/(shop)/page.tsx. */

export function SectionHead({ title, subtitle, href, linkLabel = 'View all', center = true }: { title: string; subtitle?: string | null; href?: string | null; linkLabel?: string; center?: boolean }) {
  return (
    <div className={`mb-7 ${center ? 'text-center' : 'flex items-end justify-between gap-4'}`}>
      <div className="min-w-0">
        <h2 className="font-display text-[1.9rem] font-semibold leading-tight text-night sm:text-[2.3rem]">{title}</h2>
        {subtitle && <p className="mt-1.5 text-[14.5px] text-ink/65">{subtitle}</p>}
      </div>
      {href && (
        <Link href={href} className={`inline-flex items-center gap-1.5 text-[12.5px] font-medium uppercase tracking-[0.16em] text-ink underline-offset-[6px] hover:text-brand hover:underline ${center ? 'mt-2' : 'shrink-0'}`}>
          {linkLabel} <Icon name="arrow" size={14} />
        </Link>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ hero

export function HeroSection({ title, subtitle, settings, store, fallbackImage }: {
  title: string | null; subtitle: string | null; settings: SectionSettings['hero']; store: StoreSettings; fallbackImage: string | null;
}) {
  const withPhotos = settings.slides.filter((s) => s.image);
  const slides: HeroSlide[] = withPhotos.length
    ? withPhotos.map((s) => ({ image: s.image, title: s.title || title || store.store_name, subtitle: s.subtitle || subtitle || '', button: s.button || settings.button, link: s.link || settings.link }))
    : [{ image: fallbackImage, title: title ?? store.store_name, subtitle: subtitle ?? '', button: settings.button, link: settings.link }];
  return <HeroLuxury slides={slides} eyebrow={store.tagline ?? 'New season'} secondary={{ label: 'New arrivals', href: '/products?sort=new' }} />;
}

// ---------------------------------------------------------- quick links

export function QuickLinks({ settings }: { settings: SectionSettings['quick_links'] }) {
  const links = settings.links.filter((l) => l.label && l.href);
  if (!links.length) return null;
  return (
    <nav aria-label="Quick links" className="container-page mt-8">
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:justify-center md:px-0">
        {links.map((l, i) => (
          <li key={`${l.href}-${i}`} className="shrink-0">
            <Link href={l.href} className="inline-flex rounded-full border border-night/15 px-5 py-2 text-[12.5px] font-medium uppercase tracking-[0.14em] transition hover:border-night hover:bg-night hover:text-white">
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
    <div className="container-page mt-8">
      <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-lg bg-cream px-4 py-3 text-center text-[14px] text-night">
        <span>{text}</span>
        {settings.link && (
          <Link href={settings.link} className="inline-flex items-center gap-1 font-medium uppercase tracking-[0.12em] text-brand-ink underline-offset-4 hover:underline">
            {settings.link_label || 'Learn more'} <Icon name="arrow" size={13} />
          </Link>
        )}
      </p>
    </div>
  );
}

// ------------------------------------------------------------- benefits

export function Benefits({ items }: { items: { icon: IconName; title: string; text: string; href: string }[] }) {
  return (
    <section className="border-y border-[color-mix(in_oklab,var(--brand)_10%,var(--line))] bg-[color-mix(in_oklab,var(--cream)_55%,white)]">
      <ul className="container-page grid grid-cols-2 gap-x-4 gap-y-5 py-6 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((b) => (
          <li key={b.title}>
            <Link href={b.href} className="group flex items-center gap-3 lg:justify-center">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-card text-night ring-1 ring-line transition group-hover:bg-night group-hover:text-white"><Icon name={b.icon} size={20} /></span>
              <span className="min-w-0">
                <span className="block text-[13.5px] font-semibold leading-tight text-night">{b.title}</span>
                <span className="block text-[12.5px] text-ink/60">{b.text}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ------------------------------------------------------- category tiles

export function CategoryTiles({ title, subtitle, categories, images }: { title: string | null; subtitle: string | null; categories: Category[]; images: Record<string, string | null> }) {
  if (!categories.length) return null;
  return (
    <section className="reveal container-page mt-16">
      <SectionHead title={title ?? 'Find your signature look'} subtitle={subtitle} />
      <AutoScroll label={title ?? 'Categories'}>
        {categories.map((c) => {
          const path = c.image_path && !c.image_path.startsWith('/demo/') ? c.image_path : images[c.id] ?? c.image_path ?? null;
          return (
            <div key={c.id} className="w-[30%] shrink-0 snap-start sm:w-32 md:w-36">
              <Link href={`/category/${c.slug}`} className="group flex flex-col items-center gap-3 text-center active:scale-95">
                <span className="relative block aspect-square w-full overflow-hidden rounded-full bg-cream ring-1 ring-line transition duration-300 group-hover:ring-4 group-hover:ring-[color-mix(in_oklab,var(--brand)_35%,white)]">
                  {imageUrl(path) ? (
                    <ProductImage path={path} alt="" sizes="150px" className="transition duration-500 group-hover:scale-105" />
                  ) : (
                    <span className="grid h-full place-items-center font-display text-4xl text-brand/50">{c.name[0]}</span>
                  )}
                </span>
                <span className="text-[13.5px] font-medium text-night group-hover:text-brand">{c.name}</span>
              </Link>
            </div>
          );
        })}
      </AutoScroll>
    </section>
  );
}

// ------------------------------------------------------ minimal product card

export function MiniCard({ product, className = '' }: { product: ProductWithRelations; className?: string }) {
  const { min } = priceRange(product);
  const compare = product.compare_at_price === null ? null : toNumber(product.compare_at_price);
  const off = compare !== null && compare > min ? Math.round((1 - min / compare) * 100) : 0;
  const soldOut = totalStock(product) <= 0;
  const second = product.images[1]?.storage_path;
  return (
    <Link href={`/product/${product.slug}`} className={`group block text-center ${className}`}>
      <span className="relative block aspect-[3/4] overflow-hidden rounded-md bg-cream">
        <ProductImage path={product.images[0]?.storage_path} alt={product.name} sizes="(min-width: 1024px) 14vw, (min-width: 640px) 25vw, 45vw" className={`transition duration-700 ${second ? 'group-hover:opacity-0' : 'group-hover:scale-105'}`} />
        {second && <ProductImage path={second} alt="" sizes="(min-width: 1024px) 14vw, 45vw" className="opacity-0 transition duration-700 group-hover:opacity-100" />}
        {off > 0 && <span className="absolute left-2 top-2 rounded-sm bg-brand px-1.5 py-0.5 text-[11px] font-semibold text-white">−{off}%</span>}
        {soldOut && <span className="absolute inset-x-2 bottom-2 rounded-sm bg-white/90 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-night">Sold out</span>}
      </span>
      <span className="mt-3 line-clamp-1 block font-display text-[1.08rem] font-semibold text-night group-hover:text-brand">{product.name}</span>
      <span className="mt-0.5 flex items-baseline justify-center gap-2 text-[14px]">
        <span className="font-medium text-night">{formatTaka(min)}</span>
        {off > 0 && <s className="text-[12.5px] text-ink/45">{formatTaka(compare)}</s>}
      </span>
    </Link>
  );
}

// ---------------------------------------------------------- product row

export function ProductRowSection({ title, subtitle, settings, products }: { title: string | null; subtitle: string | null; settings: SectionSettings['product_row']; products: ProductWithRelations[] }) {
  if (!products.length) return null;
  return (
    <section className="reveal container-page mt-16">
      <SectionHead title={title ?? 'Most loved this week'} subtitle={subtitle} href={settings.link || '/products'} />
      <AutoScroll autoplay={settings.autoplay} label={title ?? 'Products'}>
        {products.map((p) => (
          <div key={p.id} className="w-[44%] shrink-0 snap-start sm:w-[30%] md:w-[22%] lg:w-[calc((100%-5*1rem)/6)]">
            <MiniCard product={p} />
          </div>
        ))}
      </AutoScroll>
    </section>
  );
}

// ----------------------------------------------------------- collection

export function Collection({ title, subtitle, settings, products }: { title: string | null; subtitle: string | null; settings: SectionSettings['collection']; products: ProductWithRelations[] }) {
  if (!products.length) return null;
  const more = settings.link || '/products';
  const feature = settings.image ?? products[0]?.images[0]?.storage_path ?? null;
  const shown = products.slice(0, settings.limit);
  return (
    <section className="reveal container-page mt-16">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
        <Link href={more} className="group relative col-span-2 row-span-2 block min-h-80 overflow-hidden rounded-md bg-night">
          <ProductImage path={feature} alt="" sizes="(min-width: 1024px) 40vw, 100vw" className="opacity-90 transition duration-700 group-hover:scale-105" />
          <span className="absolute inset-0 flex flex-col justify-end bg-[linear-gradient(0deg,rgba(20,14,30,0.75),transparent_60%)] p-6 text-white sm:p-8">
            <span className="text-[11.5px] font-medium uppercase tracking-[0.28em] text-white/80">Collection</span>
            <span className="mt-1 font-display text-[clamp(1.9rem,3.2vw,2.6rem)] font-semibold leading-tight">{title ?? 'Collection'}</span>
            {subtitle && <span className="mt-1 max-w-sm text-[14px] text-white/85">{subtitle}</span>}
            <span className="btn btn-light mt-4 w-fit">Shop now</span>
          </span>
        </Link>
        {shown.map((p) => <MiniCard key={p.id} product={p} />)}
      </div>
    </section>
  );
}

// -------------------------------------------------------------- banners

/** One banner: the wide editorial layout (photo left, words right). Two or three: side by side. */
export function Banners({ eyebrow, settings, fallbackImage }: { eyebrow: string | null; settings: SectionSettings['banners']; fallbackImage: string | null }) {
  const items = settings.items.filter((b) => b.image || b.title);
  if (!items.length) return null;
  if (items.length === 1) {
    const b = items[0]!;
    const image = b.image ?? fallbackImage;
    return (
      <section className="reveal container-page mt-16">
        <div className="grid overflow-hidden rounded-md bg-cream md:grid-cols-[1.15fr_1fr]">
          <div className="relative aspect-[16/10] md:aspect-auto md:min-h-[22rem]">
            <ProductImage path={image} alt={b.title || ''} sizes="(min-width: 768px) 55vw, 100vw" />
            <span className="absolute inset-0 bg-[linear-gradient(90deg,transparent_70%,var(--cream))] max-md:hidden" aria-hidden="true" />
          </div>
          <div className="flex flex-col justify-center gap-3 p-7 md:p-12">
            {eyebrow && <p className="text-[12px] font-medium uppercase tracking-[0.28em] text-brand-ink">{eyebrow}</p>}
            {b.title && <h2 className="font-display text-[clamp(2rem,3.6vw,3rem)] font-semibold leading-[1.05] text-night">{b.title}</h2>}
            {b.subtitle && <p className="max-w-sm text-[15px] leading-relaxed text-ink/70">{b.subtitle}</p>}
            {b.link && <Link href={b.link} className="btn btn-primary mt-2 w-fit px-7">Explore now</Link>}
          </div>
        </div>
      </section>
    );
  }
  return (
    <section className="reveal container-page mt-16">
      {/* Phones: swipe or let it slide; tablets and up: side by side. */}
      <AutoScroll label="Collections">
      {items.map((b, i) => {
        const inner: ReactNode = (
          <>
            <ProductImage path={b.image} alt={b.title || 'Banner'} sizes="(min-width: 768px) 33vw, 100vw" className="transition duration-700 group-hover:scale-105" />
            {(b.title || b.subtitle) && (
              <span className="absolute inset-0 flex flex-col justify-end bg-[linear-gradient(0deg,rgba(20,14,30,0.65),transparent_60%)] p-6 text-white">
                {b.title && <span className="font-display text-[1.7rem] font-semibold leading-tight">{b.title}</span>}
                {b.subtitle && <span className="text-[13.5px] text-white/85">{b.subtitle}</span>}
              </span>
            )}
          </>
        );
        const cls = `group relative block aspect-[4/3] shrink-0 snap-start overflow-hidden rounded-md bg-cream ${items.length === 2 ? 'w-[86%] md:w-[calc((100%-1rem)/2)]' : 'w-[86%] md:w-[calc((100%-2rem)/3)]'}`;
        return b.link ? <Link key={i} href={b.link} className={cls}>{inner}</Link> : <div key={i} className={cls}>{inner}</div>;
      })}
      </AutoScroll>
    </section>
  );
}

// -------------------------------------------------------- testimonials

export function Testimonials({ title, settings, products }: { title: string | null; settings: SectionSettings['testimonials']; products: ProductWithRelations[] }) {
  const reviews = settings.items.filter((r) => r.quote && r.name);
  const shown = products.slice(0, settings.limit);
  if (!reviews.length && !shown.length) return null;
  return (
    <section className={`reveal container-page mt-16 grid gap-10 ${reviews.length && shown.length ? 'lg:grid-cols-[1.6fr_1fr]' : ''}`}>
      {shown.length > 0 && (
        <div className="min-w-0">
          <SectionHead title={settings.products_title || 'Customer favourites'} center={false} href={settings.source === 'manual' ? '/products' : null} />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {shown.map((p) => <MiniCard key={p.id} product={p} />)}
          </div>
        </div>
      )}
      {reviews.length > 0 && (
        <div className="flex min-w-0 flex-col">
          <SectionHead title={title ?? 'What our customers say'} center={false} />
          <div className="flex-1"><TestimonialSlider items={reviews} /></div>
        </div>
      )}
    </section>
  );
}

// ------------------------------------------------------------- gallery

export function Gallery({ title, settings, fallback }: { title: string | null; settings: SectionSettings['gallery']; fallback: { image: string; link: string }[] }) {
  const own = settings.images.filter((g) => g.image) as { image: string; link: string }[];
  const base = own.length ? own : fallback;
  if (!base.length) return null;
  // Always a full strip of eight: repeat the photos when there are fewer.
  const tiles = Array.from({ length: 8 }, (_, i) => base[i % base.length]!);
  return (
    <section className="reveal mt-16">
      <div className="container-page">
        <SectionHead title={title ?? 'Follow our style'} subtitle={settings.handle || null} href={settings.handle_link || null} linkLabel="Follow us" />
      </div>
      <ul className="grid grid-cols-3 gap-1 sm:grid-cols-4 lg:grid-cols-8">
        {tiles.slice(0, 8).map((g, i) => {
          const inner = (
            <>
              <ProductImage path={g.image} alt="" sizes="(min-width: 1024px) 12.5vw, 33vw" className="transition duration-700 group-hover:scale-110" />
              <span className="absolute inset-0 grid place-items-center bg-night/0 text-white opacity-0 transition group-hover:bg-night/35 group-hover:opacity-100"><Icon name="arrow" size={20} /></span>
            </>
          );
          return (
            <li key={i} className={i >= 6 ? 'hidden lg:block' : i >= 3 ? 'hidden sm:block' : ''}>
              {g.link ? (
                <Link href={g.link} className="group relative block aspect-square overflow-hidden bg-cream">{inner}</Link>
              ) : (
                <span className="group relative block aspect-square overflow-hidden bg-cream">{inner}</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------- about

export function About({ title, text, settings, store }: { title: string | null; text: string | null; settings: SectionSettings['about']; store: StoreSettings }) {
  if (!title && !text) return null;
  return (
    <section className="reveal container-page mt-16">
      <div className="grid items-center gap-8 rounded-md bg-cream p-7 md:grid-cols-[1.2fr_1fr] md:p-12">
        <div>
          <p className="text-[12px] font-medium uppercase tracking-[0.28em] text-brand-ink">{store.store_name}</p>
          {title && <h2 className="mt-2 font-display text-[clamp(1.9rem,3.2vw,2.6rem)] font-semibold leading-tight text-night">{title}</h2>}
          {text && <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-ink/75">{text}</p>}
          {settings.link && <Link href={settings.link} className="btn btn-dark-outline mt-5">{settings.link_label || 'Learn more'}</Link>}
        </div>
        {settings.image && (
          <div className="relative aspect-[4/3] overflow-hidden rounded-md">
            <ProductImage path={settings.image} alt="" sizes="(min-width: 768px) 40vw, 100vw" />
          </div>
        )}
      </div>
    </section>
  );
}
