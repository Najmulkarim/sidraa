import Link from 'next/link';
import type { ReactNode } from 'react';
import { lbl, type SectionSettings } from '@/lib/home-sections';
import { formatTaka } from '@/lib/format';
import type { Category, ProductWithRelations } from '@/lib/types';
import { Icon, type IconName } from '../../icons';
import { ProductImage } from '../ProductImage';
import { AutoScroll } from './AutoScroll';
import { Countdown } from './Countdown';
import { MarketCard } from './MarketSections';
import { info } from './ThemeSections';

/**
 * "Mega" home theme: a department-store front with a left sidebar
 * (categories, a tall offer, latest products, service points) next to the
 * main column. On phones the sidebar folds into a category row on top.
 */

const pic = (c: Category, covers: Record<string, string | null>) => (c.image_path && !c.image_path.startsWith('/demo/') ? c.image_path : covers[c.id] ?? c.image_path ?? null);

function Tab({ children }: { children: ReactNode }) {
  return <h2 className="inline-block rounded-t-lg bg-night px-4 py-2 font-display text-[14px] font-bold uppercase tracking-wide text-white">{children}</h2>;
}

/** The whole page frame: sidebar + main column. Sections inside lose their own page padding. */
export function MegaFrame({ sidebar, top, children }: { sidebar: ReactNode; top: ReactNode; children: ReactNode }) {
  return (
    <div className="container-page mt-5 grid gap-6 lg:grid-cols-[15.5rem_minmax(0,1fr)]">
      <aside className="hidden space-y-6 lg:block">{sidebar}</aside>
      <div className="min-w-0 [&_.container-page]:max-w-none [&_.container-page]:px-0 [&>section:first-child]:mt-0 [&>*:first-child]:mt-0">
        <div className="lg:hidden">{top}</div>
        {children}
      </div>
    </div>
  );
}

/** Sidebar: category list, a tall offer picture, latest products, service points. */
export function MegaSidebar({ categories, covers, latest, benefits, offer, settings }: {
  categories: Category[]; covers: Record<string, string | null>; latest: ProductWithRelations[];
  benefits: { icon: IconName; title: string; text: string; href: string }[];
  offer: { image: string | null; title: string; subtitle: string; link: string } | null;
  settings?: SectionSettings['banners'];
}) {
  return (
    <>
      <nav aria-label="All categories" className="overflow-hidden rounded-xl border border-line bg-white">
        <p className="flex items-center gap-2 bg-brand px-4 py-3 text-[14px] font-bold uppercase tracking-wide text-white"><Icon name="menu" size={18} /> {lbl(settings, 'cats_title', 'All categories')}</p>
        <ul className="divide-y divide-line">
          {categories.slice(0, 12).map((c) => (
            <li key={c.id}>
              <Link href={`/category/${c.slug}`} className="group flex items-center gap-3 px-4 py-2.5 text-[13.5px] text-night hover:bg-tint hover:text-brand">
                <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-md bg-soft"><ProductImage path={pic(c, covers)} alt="" sizes="28px" /></span>
                <span className="flex-1 truncate">{c.name}</span>
                <Icon name="arrow" size={13} className="text-ink/30 group-hover:text-brand" />
              </Link>
            </li>
          ))}
          <li><Link href="/products" className="flex items-center gap-2 px-4 py-2.5 text-[13.5px] font-semibold text-brand hover:bg-tint"><Icon name="plus" size={14} /> {lbl(settings, 'all_products', 'All products')}</Link></li>
        </ul>
      </nav>

      {offer && (
        <Link href={offer.link} className="group relative block aspect-[3/5] overflow-hidden rounded-xl bg-night">
          <ProductImage path={offer.image} alt="" sizes="250px" className="opacity-90 transition duration-700 group-hover:scale-105" />
          <span className="absolute inset-x-0 top-0 space-y-1 bg-[linear-gradient(180deg,rgba(20,14,30,.7),transparent)] p-5 text-white">
            <b className="block font-display text-[1.35rem] leading-tight">{offer.title}</b>
            {offer.subtitle && <span className="block text-[12.5px] font-semibold uppercase tracking-wide text-white/85">{offer.subtitle}</span>}
            <span className="inline-block pt-1 text-[13px] font-semibold underline">{lbl(settings, 'button', 'Shop now')}</span>
          </span>
        </Link>
      )}

      {latest.length > 0 && (
        <section>
          <h2 className="mb-3 border-b-2 border-brand pb-2 font-display text-[15px] font-bold uppercase text-night">{lbl(settings, 'list2', 'Latest products')}</h2>
          <ul className="space-y-3">
            {latest.slice(0, 4).map((p) => {
              const d = info(p);
              return (
                <li key={p.id}>
                  <Link href={`/product/${p.slug}`} className="flex items-center gap-3 hover:text-brand">
                    <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-soft"><ProductImage path={d.image} alt="" sizes="64px" /></span>
                    <span className="min-w-0">
                      <span className="line-clamp-2 text-[13px] text-night">{p.name}</span>
                      <span className="flex items-baseline gap-1.5"><b className="text-[14px] text-brand">{formatTaka(d.min)}</b>{d.off > 0 && <s className="text-[11.5px] text-ink/40">{formatTaka(d.compare)}</s>}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <ul className="divide-y divide-line rounded-xl border border-line bg-white">
        {benefits.slice(0, 4).map((b) => (
          <li key={b.title}>
            <Link href={b.href} className="flex items-center gap-3 px-4 py-3.5">
              <Icon name={b.icon} size={24} className="shrink-0 text-brand" />
              <span className="leading-tight"><b className="block text-[13px] uppercase text-night">{b.title}</b><span className="text-[12px] text-ink/55">{b.text}</span></span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Phones: the sidebar's categories as a sideways row of chips with photos. */
export function MegaMobileCategories({ categories, covers }: { categories: Category[]; covers: Record<string, string | null> }) {
  if (!categories.length) return null;
  return (
    <ul className="-mx-4 mb-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {categories.map((c) => (
        <li key={c.id} className="shrink-0 snap-start">
          <Link href={`/category/${c.slug}`} className="flex items-center gap-2 rounded-full border border-line bg-white py-1 pl-1 pr-3.5 text-[13px] font-semibold text-night">
            <span className="relative h-8 w-8 overflow-hidden rounded-full bg-soft"><ProductImage path={pic(c, covers)} alt="" sizes="32px" /></span>{c.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** "Gift special" ribbon strip (a Notice section). */
export function MegaNotice({ title, text, settings }: { title: string | null; text: string | null; settings: SectionSettings['notice'] }) {
  if (!text && !title) return null;
  return (
    <section className="container-page mt-5">
      <div className="flex flex-col overflow-hidden rounded-xl border border-brand/30 bg-[#fff6f8] sm:flex-row sm:items-center sm:gap-3 sm:pr-3">
        <span className="flex shrink-0 items-center gap-2 bg-brand py-2.5 pl-4 pr-6 text-[13.5px] font-bold uppercase text-white sm:py-3 sm:[clip-path:polygon(0_0,100%_0,calc(100%-14px)_100%,0_100%)]">
          <Icon name="ticket" size={18} /> {title ?? 'Gift special'}
        </span>
        {text && <p className="min-w-0 flex-1 px-4 py-2.5 text-[13.5px] text-ink/80 sm:px-0">{text}</p>}
        {settings.link && <Link href={settings.link} className="btn btn-sm mx-4 mb-3 shrink-0 self-start rounded-md bg-brand text-white hover:bg-night sm:m-0 sm:self-auto">{settings.link_label || 'Shop now'}</Link>}
      </div>
    </section>
  );
}

/** Daily deals: wide cards (photo left, details right) with a stock bar; countdown only with a real end time. */
export function MegaDeals({ title, settings, products }: { title: string | null; settings: SectionSettings['deal']; products: ProductWithRelations[] }) {
  if (!products.length) return null;
  const running = settings.ends_at && Date.parse(settings.ends_at) > Date.now();
  return (
    <section className="container-page mt-8">
      <div className="mb-4 flex items-end justify-between border-b-2 border-night"><Tab>{title ?? 'Daily deals'}</Tab>{running && <span className="mb-1.5"><Countdown endsAt={settings.ends_at!} /></span>}</div>
      <AutoScroll label={title ?? 'Daily deals'}>
        {products.map((p) => {
          const d = info(p);
          const left = Math.max(0, d.stock);
          return (
            <div key={p.id} className="w-[88%] shrink-0 snap-start md:w-[calc((100%-1rem)/2)]">
              <Link href={`/product/${p.slug}`} className="group grid h-full grid-cols-[42%_1fr] gap-4 rounded-xl border border-line bg-white p-3 hover:border-brand/50 hover:shadow-[var(--shadow)]">
                <span className="relative aspect-square overflow-hidden rounded-lg bg-soft">
                  <ProductImage path={d.image} alt={p.name} sizes="(min-width: 768px) 16vw, 38vw" className="transition duration-500 group-hover:scale-105" />
                  {d.off > 0 && <span className="absolute right-2 top-2 grid h-11 w-11 place-items-center rounded-full bg-brand text-[12px] font-bold text-white">-{d.off}%</span>}
                </span>
                <span className="flex min-w-0 flex-col justify-center gap-1.5">
                  <b className="line-clamp-2 text-[15px] text-night group-hover:text-brand">{p.name}</b>
                  <span className="flex items-baseline gap-2"><b className="text-[18px] text-brand">{formatTaka(d.min)}</b>{d.off > 0 && <s className="text-[13px] text-ink/40">{formatTaka(d.compare)}</s>}</span>
                  {left > 0 && left < 99 && (
                    <span className="block">
                      <span className="text-[12px] text-ink/60">Available: <b className="text-brand">{left}</b></span>
                      <span className="mt-1 block h-2 overflow-hidden rounded-full bg-soft"><span className="block h-full rounded-full bg-brand" style={{ width: `${Math.max(8, Math.min(100, (left / 30) * 100))}%` }} /></span>
                    </span>
                  )}
                  {running && <Countdown endsAt={settings.ends_at!} />}
                </span>
              </Link>
            </div>
          );
        })}
      </AutoScroll>
    </section>
  );
}

/** Wide picture banner with a round badge (the section title) and a button. */
export function MegaBanner({ eyebrow, settings, images }: { eyebrow: string | null; settings: SectionSettings['banners']; images: string[] }) {
  const b = settings.items.find((x) => x.image || x.title);
  if (!b) return null;
  return (
    <section className="container-page mt-8">
      <Link href={b.link || '/products'} className="group relative grid min-h-40 items-center overflow-hidden rounded-xl bg-[#f3eef0] sm:grid-cols-[auto_1fr_1fr]">
        {eyebrow && (
          <span className="z-10 ml-5 mt-5 grid h-24 w-24 shrink-0 place-items-center rounded-full border-4 border-white bg-brand p-2 text-center text-[13px] font-extrabold leading-tight text-white shadow-lg sm:mt-0">{eyebrow}</span>
        )}
        <span className="relative z-10 space-y-1.5 p-5 text-center sm:text-left">
          {b.title && <b className="block font-display text-[clamp(1.3rem,2.6vw,1.9rem)] font-bold leading-tight text-night">{b.title}</b>}
          {b.subtitle && <span className="block text-[13.5px] text-ink/65">{b.subtitle}</span>}
          <span className="btn btn-sm mt-1 rounded-md bg-brand text-white group-hover:bg-night">{lbl(settings, 'button', 'Shop now')}</span>
        </span>
        <span className="relative hidden h-full min-h-40 sm:block"><ProductImage path={b.image ?? images[0] ?? null} alt="" sizes="35vw" className="transition duration-700 group-hover:scale-105" /></span>
      </Link>
    </section>
  );
}

/** "Trending items": dark tab title, category links as tabs, five-to-a-line grid. */
export function MegaGrid({ title, settings, products, categories }: { title: string | null; settings: SectionSettings['product_row']; products: ProductWithRelations[]; categories: Category[] }) {
  if (!products.length) return null;
  return (
    <section className="container-page mt-8">
      <div className="mb-4 flex flex-wrap items-end gap-x-5 gap-y-2 border-b-2 border-night">
        <Tab>{title ?? 'Trending items'}</Tab>
        <nav className="ml-auto flex max-w-full gap-4 overflow-x-auto pb-2 text-[13px] font-semibold [scrollbar-width:none]" aria-label="Categories">
          <Link href={settings.link || '/products'} className="shrink-0 text-brand">All</Link>
          {categories.slice(0, 6).map((c) => <Link key={c.id} href={`/category/${c.slug}`} className="shrink-0 text-ink/60 hover:text-brand">{c.name}</Link>)}
        </nav>
      </div>
      {settings.layout === 'row' ? (
        <AutoScroll autoplay={settings.autoplay} label={title ?? 'Products'}>
          {products.map((p) => <div key={p.id} className="w-[46%] shrink-0 snap-start sm:w-[31%] md:w-[calc((100%-4*1rem)/5)]"><MarketCard product={p} /></div>)}
        </AutoScroll>
      ) : (
        <>
          {/* Full rows of five on wide screens (no lonely card at the end). */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">{(products.length > 5 ? products.slice(0, Math.floor(products.length / 5) * 5) : products).map((p) => <MarketCard key={p.id} product={p} />)}</div>
          <div className="mt-6 text-center"><Link href={settings.link || '/products'} className="btn btn-dark-outline rounded-full px-8">{lbl(settings, 'grid_button', 'View all products')} <Icon name="arrow" size={15} /></Link></div>
        </>
      )}
    </section>
  );
}
