import Link from 'next/link';
import { lbl, type SectionSettings } from '@/lib/home-sections';
import { formatTaka } from '@/lib/format';
import type { Category, ProductWithRelations, StoreSettings } from '@/lib/types';
import { Icon } from '../../icons';
import { ProductImage } from '../ProductImage';
import { AutoScroll } from './AutoScroll';
import { CartIconButton } from './CartIconButton';
import { Countdown } from './Countdown';
import { info } from './ThemeSections';
import { Stars } from '../Stars';

/**
 * "Market" home theme: a busy store front — mini category tiles, a big
 * banner with two small ones, flash deals with real stock bars, a category
 * grid, promo banners, product rows and a three-column list. Phones get one
 * column of banners and sideways-scrolling rows.
 */

const TILE_BG = ['#fdecef', '#fff4dc', '#e7f4ee', '#ece9fb', '#e6f2fb', '#fbeee6'];
const PROMO_BG = ['bg-[#fde3ea]', 'bg-[#dff1ec]', 'bg-[#fde7d6]', 'bg-[#e9e4fb]'];

function Title({ title, href, link = 'View all', extra }: { title: string; href?: string | null; link?: string; extra?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <h2 className="font-display text-[1.35rem] font-bold text-night sm:text-[1.55rem]">{title}</h2>
      {extra}
      {href && <Link href={href} className="ml-auto inline-flex items-center gap-1 text-[13px] font-semibold text-brand hover:underline">{link} <Icon name="arrow" size={14} /></Link>}
    </div>
  );
}

const pic = (c: Category, covers: Record<string, string | null>) => (c.image_path && !c.image_path.startsWith('/demo/') ? c.image_path : covers[c.id] ?? c.image_path ?? null);

/** Small coloured category tiles under the header. */
export function MarketTiles({ categories, covers, counts }: { categories: Category[]; covers: Record<string, string | null>; counts: Record<string, number> }) {
  if (!categories.length) return null;
  return (
    <section className="container-page mt-4">
      <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-5 md:px-0 [&::-webkit-scrollbar]:hidden">
        {categories.slice(0, 5).map((c, i) => (
          <li key={c.id} className="w-[46%] shrink-0 snap-start md:w-auto">
            <Link href={`/category/${c.slug}`} className="flex items-center gap-2.5 rounded-xl p-2.5 transition hover:shadow-md" style={{ background: TILE_BG[i % TILE_BG.length] }}>
              <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-white"><ProductImage path={pic(c, covers)} alt="" sizes="44px" /></span>
              <span className="min-w-0 leading-tight">
                <b className="block truncate text-[13px] text-night">{c.name}</b>
                {counts[c.id] ? <span className="text-[11.5px] font-semibold uppercase text-brand-ink">{counts[c.id]} items</span> : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Big banner left, two small ones right (one column on phones). Slides 1–3 fill them; product photos fill the gaps. */
export function MarketHero({ title, subtitle, settings, store, products }: {
  title: string | null; subtitle: string | null; settings: SectionSettings['hero']; store: StoreSettings; products: ProductWithRelations[];
}) {
  const photos = products.filter((p) => p.images[0]).map((p) => p.images[0]!.storage_path);
  const slides = [0, 1, 2].map((n) => {
    const s = settings.slides[n];
    return {
      image: s?.image ?? photos[n] ?? null,
      title: s?.title || (n === 0 ? title || store.store_name : n === 1 ? 'New arrivals' : 'Best sellers'),
      subtitle: s?.subtitle || (n === 0 ? subtitle || '' : n === 1 ? 'Fresh styles this week' : 'Customer favourites'),
      button: s?.button || (n === 0 ? settings.button || 'Shop now' : 'Shop now'),
      link: s?.link || (n === 0 ? settings.link || '/products' : n === 1 ? '/products?sort=new' : '/products'),
    };
  });
  const [big, a, b] = slides as [typeof slides[0], typeof slides[0], typeof slides[0]];
  const Panel = ({ s, large, bg }: { s: typeof big; large?: boolean; bg: string }) => (
    <Link href={s.link} className={`group relative flex overflow-hidden rounded-2xl ${bg} ${large ? 'min-h-64 md:min-h-[22rem]' : 'min-h-40'}`}>
      <span className={`absolute inset-y-0 right-0 ${large ? 'w-[42%] md:w-[55%]' : 'w-[42%] md:w-1/2'}`}>
        <ProductImage path={s.image} alt="" sizes={large ? '(min-width: 768px) 35vw, 55vw' : '(min-width: 768px) 18vw, 50vw'} priority={large} quality={90} className="transition duration-700 group-hover:scale-105" />
      </span>
      <span className={`relative z-10 flex flex-col justify-center gap-2 p-5 ${large ? 'max-w-[60%] md:max-w-[50%] md:p-9' : 'max-w-[60%] md:max-w-[55%]'}`}>
        {large && <span className="w-fit rounded bg-brand px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-white">{lbl(settings, 'eyebrow', 'New')}</span>}
        <b className={`font-display leading-tight text-night ${large ? 'text-[clamp(1.6rem,3.4vw,2.7rem)] font-bold' : 'text-[1.25rem] font-semibold'}`}>{s.title}</b>
        {s.subtitle && <span className={`text-ink/70 ${large ? 'text-[15px]' : 'text-[12.5px] font-semibold uppercase tracking-wide'}`}>{s.subtitle}</span>}
        <span className={`btn mt-1 w-fit rounded-full ${large ? 'bg-white px-5 text-night shadow' : 'btn-sm bg-white text-night'}`}>{s.button} <Icon name="arrow" size={14} /></span>
      </span>
    </Link>
  );
  return (
    <section className="container-page mt-4 grid gap-4 md:grid-cols-[1.75fr_1fr]">
      <Panel s={big} large bg="bg-[linear-gradient(115deg,#fde3c4,#fbd0a0)]" />
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-1">
        <Panel s={a} bg="bg-[linear-gradient(115deg,#f9dbe8,#f3c1d6)]" />
        <Panel s={b} bg="bg-[linear-gradient(115deg,#dff1ec,#c6e6dc)]" />
      </div>
    </section>
  );
}

/** Product card: white box, square photo, Sale/Hot tag, price with % off, optional stock bar. */
export function MarketCard({ product, stockBar }: { product: ProductWithRelations; stockBar?: boolean }) {
  const d = info(product);
  const pct = d.off;
  const left = Math.max(0, d.stock);
  return (
    <div className="group flex h-full flex-col rounded-xl border border-line bg-white p-2.5 transition hover:border-brand/50 hover:shadow-[var(--shadow)]">
      <Link href={`/product/${product.slug}`} className="relative block aspect-square overflow-hidden rounded-lg bg-soft">
        <ProductImage path={d.image} alt={product.name} sizes="(min-width: 1024px) 18vw, 45vw" className="transition duration-500 group-hover:scale-105" />
        <span className="absolute left-2 top-2 flex flex-col gap-1">
          {d.badge && <span className="rounded bg-[#16a34a] px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">{d.preorder ? 'Pre-order' : 'Sale'}</span>}
          {product.is_featured && <span className="w-fit rounded bg-brand px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">Hot</span>}
        </span>
      </Link>
      <div className="flex flex-1 flex-col gap-1 px-0.5 pt-2.5">
        <Link href={`/product/${product.slug}`} className="line-clamp-2 min-h-[2.5em] text-[13.5px] font-medium leading-snug text-night hover:text-brand">{product.name}</Link>
        {product.category && <span className="text-[11.5px] text-ink/50">{product.category.name}</span>}
        <p className="flex flex-wrap items-baseline gap-x-1.5">
          {pct > 0 && <s className="text-[12px] text-ink/40">{formatTaka(d.compare)}</s>}
          <span className="text-[15px] font-bold text-brand">{formatTaka(d.min)}</span>
          {pct > 0 && <span className="text-[12px] font-semibold text-[#16a34a]">({pct}%)</span>}
        </p>
        {stockBar && left > 0 && left < 99 && (
          <span className="mt-1 block">
            <span className="text-[11.5px] text-ink/60">Available: <b className="text-night">{left}</b></span>
            <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-soft"><span className="block h-full rounded-full bg-brand" style={{ width: `${Math.max(8, Math.min(100, (left / 30) * 100))}%` }} /></span>
          </span>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          {product.rating_count > 0
            ? <Stars avg={product.rating_avg} count={product.rating_count} />
            : <span className="flex min-w-0 items-center gap-1 text-[11.5px] font-medium text-ink/55"><Icon name="cash" size={14} className="shrink-0 text-[#16a34a]" /><span className="truncate">Cash on delivery</span></span>}
          <CartIconButton productId={product.id} productName={product.name} productSlug={product.slug} imagePath={d.image} price={d.min} variantId={d.single} soldOut={d.stock <= 0} look="icon" />
        </div>
      </div>
    </div>
  );
}

const rowItem = 'w-[46%] shrink-0 snap-start sm:w-[31%] md:w-[23%] lg:w-[calc((100%-4*1rem)/5)]';

/** Flash deals: a real countdown only when an end time is set; products with stock bars. */
export function MarketDeals({ title, settings, products }: { title: string | null; settings: SectionSettings['deal']; products: ProductWithRelations[] }) {
  if (!products.length) return null;
  const running = settings.ends_at && Date.parse(settings.ends_at) > Date.now();
  return (
    <section className="container-page mt-10">
      <Title
        title={title ?? 'Flash Deals'}
        href={settings.link || '/products'}
        extra={running ? <span className="rounded-lg bg-brand px-2 py-1 text-white"><Countdown endsAt={settings.ends_at!} tone="dark" /></span> : settings.eyebrow ? <span className="rounded-full bg-tint px-3 py-1 text-[12px] font-bold text-brand-ink">{settings.eyebrow}</span> : null}
      />
      <AutoScroll label={title ?? 'Flash deals'}>
        {products.map((p) => <div key={p.id} className={rowItem}><MarketCard product={p} stockBar /></div>)}
      </AutoScroll>
    </section>
  );
}

/** One wide promo band, or two banners side by side (stacked on phones). */
export function MarketBanners({ eyebrow, settings, images }: { eyebrow: string | null; settings: SectionSettings['banners']; images: string[] }) {
  const items = settings.items.filter((b) => b.image || b.title);
  if (!items.length) return null;
  const button = lbl(settings, 'button', 'Shop now');
  if (items.length === 1) {
    const b = items[0]!;
    return (
      <section className="container-page mt-10">
        <Link href={b.link || '/products'} className="group grid min-h-36 items-center overflow-hidden rounded-2xl bg-[#fde3ea] sm:grid-cols-[1.3fr_1fr_auto]">
          <span className="space-y-1 p-6 sm:p-8">
            {eyebrow && <span className="block text-[11.5px] font-bold uppercase tracking-[0.16em] text-brand-ink">{eyebrow}</span>}
            {b.title && <b className="block font-display text-[clamp(1.5rem,3vw,2.2rem)] font-bold leading-tight text-night">{b.title}</b>}
            {b.subtitle && <span className="block text-[14px] text-ink/70">{b.subtitle}</span>}
          </span>
          <span className="relative hidden h-full min-h-36 sm:block"><ProductImage path={b.image ?? images[0] ?? null} alt="" sizes="30vw" className="transition duration-700 group-hover:scale-105" /></span>
          <span className="btn m-6 w-fit rounded-full bg-night text-white group-hover:bg-brand">{button} <Icon name="arrow" size={14} /></span>
        </Link>
      </section>
    );
  }
  return (
    <section className="container-page mt-10 grid gap-4 md:grid-cols-2">
      {items.slice(0, 2).map((b, i) => (
        <Link key={i} href={b.link || '/products'} className={`group relative flex min-h-44 overflow-hidden rounded-2xl ${PROMO_BG[i % PROMO_BG.length]}`}>
          <span className="relative z-10 flex max-w-[58%] flex-col justify-center gap-1.5 p-6">
            {b.title && <b className="font-display text-[1.45rem] font-bold leading-tight text-night">{b.title}</b>}
            {b.subtitle && <span className="text-[12.5px] font-semibold uppercase tracking-wide text-ink/65">{b.subtitle}</span>}
            <span className="btn btn-sm mt-1 w-fit rounded-full bg-white text-night shadow-sm">{button}</span>
          </span>
          <span className="absolute inset-y-0 right-0 w-[45%]"><ProductImage path={b.image ?? images[i] ?? images[0] ?? null} alt="" sizes="(min-width: 768px) 22vw, 45vw" className="transition duration-700 group-hover:scale-105" /></span>
        </Link>
      ))}
    </section>
  );
}

/** "Shop By Category": square tiles, 3 on phones, 6 on wide screens. */
export function MarketCategoryGrid({ title, categories, covers, settings }: { title: string | null; categories: Category[]; covers: Record<string, string | null>; settings?: SectionSettings['category_tiles'] }) {
  if (!categories.length) return null;
  return (
    <section className="container-page mt-10">
      <Title title={title ?? 'Shop By Category'} href="/products" link={lbl(settings, 'view_all', 'View all')} />
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
        {categories.slice(0, 12).map((c) => (
          <li key={c.id}>
            <Link href={`/category/${c.slug}`} className="group block text-center">
              <span className="relative block aspect-square overflow-hidden rounded-xl border-[1.5px] border-[color-mix(in_oklab,var(--brand)_25%,var(--line))] bg-white p-1.5 transition group-hover:border-brand">
                <span className="relative block h-full w-full overflow-hidden rounded-lg"><ProductImage path={pic(c, covers)} alt="" sizes="(min-width: 768px) 14vw, 30vw" /></span>
              </span>
              <span className="mt-1.5 block truncate text-[12.5px] font-semibold text-night group-hover:text-brand">{c.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A product row (popular deals) or a 5-per-line grid (recommended). */
export function MarketProducts({ title, settings, products }: { title: string | null; settings: SectionSettings['product_row']; products: ProductWithRelations[] }) {
  if (!products.length) return null;
  const head = <Title title={title ?? 'Popular deals'} href={settings.link || '/products'} link={lbl(settings, 'view_all', 'View all')} />;
  if (settings.layout === 'grid') {
    return (
      <section className="container-page mt-10">
        {head}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">{products.map((p) => <MarketCard key={p.id} product={p} />)}</div>
        <div className="mt-6 text-center"><Link href={settings.link || '/products'} className="btn btn-dark-outline rounded-full px-8">{lbl(settings, 'grid_button', 'View all products')} <Icon name="arrow" size={15} /></Link></div>
      </section>
    );
  }
  return (
    <section className="container-page mt-10 rounded-none bg-[color-mix(in_oklab,var(--accent)_10%,white)] py-6 md:rounded-2xl md:px-5">
      {head}
      <AutoScroll autoplay={settings.autoplay} label={title ?? 'Products'}>
        {products.map((p) => <div key={p.id} className={rowItem}><MarketCard product={p} /></div>)}
      </AutoScroll>
    </section>
  );
}

/** New launches / Trending / On sale: three short lists (stacked on phones). */
export function MarketTrio({ lists }: { lists: { title: string; href: string; tone: string; products: ProductWithRelations[] }[] }) {
  const shown = lists.filter((l) => l.products.length);
  if (!shown.length) return null;
  return (
    <section className="container-page mt-10 grid gap-5 md:grid-cols-3">
      {shown.map((l) => (
        <div key={l.title} className="rounded-2xl border border-line bg-white p-3">
          <Link href={l.href} className={`mb-3 flex items-center justify-between rounded-xl px-4 py-3 ${l.tone}`}>
            <b className="font-display text-[1.15rem] text-night">{l.title}</b>
            <Icon name="arrow" size={16} />
          </Link>
          <ul className="divide-y divide-line">
            {l.products.slice(0, 4).map((p) => {
              const d = info(p);
              return (
                <li key={p.id}>
                  <Link href={`/product/${p.slug}`} className="flex items-center gap-3 py-2.5 hover:text-brand">
                    <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-soft"><ProductImage path={d.image} alt="" sizes="64px" /></span>
                    <span className="min-w-0">
                      <span className="line-clamp-2 text-[13px] font-medium text-night">{p.name}</span>
                      <span className="mt-0.5 flex items-baseline gap-1.5 text-[13.5px]">
                        <b className="text-brand">{formatTaka(d.min)}</b>
                        {d.off > 0 && <s className="text-[11.5px] text-ink/40">{formatTaka(d.compare)}</s>}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
