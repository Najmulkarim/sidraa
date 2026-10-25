import Link from 'next/link';
import type { ReactNode } from 'react';
import { lbl, type SectionSettings } from '@/lib/home-sections';
import { formatTaka } from '@/lib/format';
import type { Category, ProductWithRelations, StoreSettings } from '@/lib/types';
import { Icon } from '../../icons';
import { ProductImage } from '../ProductImage';
import { AutoScroll } from './AutoScroll';
import { CartIconButton } from './CartIconButton';
import { info } from './ThemeSections';

/**
 * "TopDeal" home theme: navy deals store — a big banner with six small
 * tiles, round category pictures, then a left column (special items, a
 * tall offer, recommended) beside the deals, banner and product strips.
 */

const TILE_BG = ['bg-[#1f2a44]', 'bg-[#e11d48]', 'bg-[#efe3ff]', 'bg-[#0f9d8a]', 'bg-[#f97316]', 'bg-[#166534]'];
const TILE_DARK = [true, true, false, true, true, true];
const pic = (c: Category, covers: Record<string, string | null>) => (c.image_path && !c.image_path.startsWith('/demo/') ? c.image_path : covers[c.id] ?? c.image_path ?? null);

function Heading({ children, extra, href }: { children: ReactNode; extra?: ReactNode; href?: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 border-b-2 border-night/80 pb-2">
      <h2 className="flex items-center gap-2 font-display text-[1.05rem] font-bold uppercase tracking-wide text-night"><Icon name="tag" size={17} className="text-brand" />{children}</h2>
      {extra}
      {href && <Link href={href} className="ml-auto text-[13px] font-semibold text-night hover:text-brand">View all</Link>}
    </div>
  );
}

/** Big banner left; up to six small tiles right (hero slides 2–7, else the categories). */
export function TopHero({ title, subtitle, settings, store, products, categories, covers }: {
  title: string | null; subtitle: string | null; settings: SectionSettings['hero']; store: StoreSettings; products: ProductWithRelations[];
  categories: Category[]; covers: Record<string, string | null>;
}) {
  const photos = products.filter((p) => p.images[0]).map((p) => p.images[0]!.storage_path);
  const s0 = settings.slides[0];
  const big = { image: s0?.image ?? photos[0] ?? null, title: s0?.title || title || store.store_name, subtitle: s0?.subtitle || subtitle || '', button: s0?.button || settings.button || 'Shop now', link: s0?.link || settings.link || '/products' };
  const extra = settings.slides.slice(1, 7).filter((s) => s.image || s.title);
  const tiles = (extra.length
    ? extra.map((s) => ({ image: s.image, title: s.title, subtitle: s.subtitle, link: s.link || '/products' }))
    : categories.slice(0, 6).map((c) => ({ image: pic(c, covers), title: c.name, subtitle: 'Shop now', link: `/category/${c.slug}` }))).slice(0, 6);
  // An even grid: fill a gap with the whole shop.
  if (tiles.length % 2 === 1) tiles.push({ image: photos[1] ?? null, title: 'Shop all', subtitle: 'Every style', link: '/products' });
  return (
    <section className="container-page mt-4 grid gap-3 lg:grid-cols-[1.45fr_1fr]">
      <Link href={big.link} className="group relative flex min-h-60 overflow-hidden rounded-2xl bg-[linear-gradient(115deg,#ffd166,#fbbf24)] sm:min-h-80">
        <span className="absolute inset-y-0 right-0 w-1/2"><ProductImage path={big.image} alt="" sizes="(min-width: 1024px) 30vw, 50vw" priority quality={90} className="transition duration-700 group-hover:scale-105" /></span>
        <span className="relative z-10 flex max-w-[56%] flex-col justify-center gap-2 p-6 sm:p-9">
          <span className="w-fit -rotate-6 rounded-full border-2 border-night px-3 py-1 text-[12px] font-extrabold uppercase text-night">{lbl(settings, 'eyebrow', 'Super deal')}</span>
          <b className="font-display text-[clamp(1.8rem,4.2vw,3.4rem)] font-extrabold uppercase leading-[1.02] text-brand">{big.title}</b>
          {big.subtitle && <span className="text-[14.5px] font-semibold text-night/80">{big.subtitle}</span>}
          <span className="btn mt-1 w-fit rounded-lg bg-night text-white group-hover:bg-brand">{big.button}</span>
        </span>
      </Link>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2">
        {tiles.map((t, i) => (
          <Link key={i} href={t.link} className={`group relative flex min-h-28 overflow-hidden rounded-xl ${TILE_BG[i % TILE_BG.length]}`}>
            <span className="absolute inset-y-0 right-0 w-1/2"><ProductImage path={t.image} alt="" sizes="(min-width: 1024px) 10vw, 25vw" className="transition duration-500 group-hover:scale-105" /></span>
            <span className={`relative z-10 flex max-w-[58%] flex-col justify-center p-3 ${TILE_DARK[i % TILE_DARK.length] ? 'text-white' : 'text-night'}`}>
              <b className="text-[13.5px] uppercase leading-tight">{t.title}</b>
              {t.subtitle && <span className="mt-1 text-[11.5px] font-semibold opacity-85">{t.subtitle}</span>}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Round category pictures with a coloured name band. */
export function TopCircles({ categories, covers }: { categories: Category[]; covers: Record<string, string | null> }) {
  if (!categories.length) return null;
  return (
    <section className="container-page mt-8">
      <AutoScroll label="Categories">
        {categories.slice(0, 12).map((c) => (
          <div key={c.id} className="w-[30%] shrink-0 snap-start sm:w-[22%] md:w-[15%] lg:w-[calc((100%-5*1rem)/6)]">
            <Link href={`/category/${c.slug}`} className="group block">
              <span className="relative block aspect-square overflow-hidden rounded-full bg-soft ring-4 ring-white shadow-md">
                <ProductImage path={pic(c, covers)} alt="" sizes="160px" className="transition duration-500 group-hover:scale-110" />
                <span className="absolute inset-x-0 bottom-0 bg-[#fbbf24] py-1.5 text-center text-[11px] font-bold text-night">{c.name}</span>
              </span>
            </Link>
          </div>
        ))}
      </AutoScroll>
    </section>
  );
}

function MiniList({ title, products, href }: { title: string; products: ProductWithRelations[]; href: string }) {
  if (!products.length) return null;
  return (
    <section className="overflow-hidden rounded-xl border border-line bg-white">
      <h2 className="flex items-center gap-2 bg-night px-4 py-3 text-[13.5px] font-bold text-white"><Icon name="tag" size={15} /> {title}</h2>
      <ul className="divide-y divide-line px-3">
        {products.slice(0, 5).map((p) => {
          const d = info(p);
          return (
            <li key={p.id}>
              <Link href={`/product/${p.slug}`} className="flex items-center gap-3 py-2.5 hover:text-brand">
                <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-soft"><ProductImage path={d.image} alt="" sizes="56px" /></span>
                <span className="min-w-0">
                  <span className="line-clamp-1 text-[12.5px] text-night">{p.name}</span>
                  <span className="flex items-baseline gap-1.5"><b className="text-[14px] text-night">{formatTaka(d.min)}</b>{d.off > 0 && <s className="text-[11.5px] text-ink/40">{formatTaka(d.compare)}</s>}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <Link href={href} className="m-3 block rounded-lg bg-[#e8edf8] py-2 text-center text-[12.5px] font-bold uppercase text-night hover:bg-night hover:text-white">View all items</Link>
    </section>
  );
}

/** Left column: special items, the tall offer, recommended items. */
export function TopSidebar({ featured, latest, offer }: { featured: ProductWithRelations[]; latest: ProductWithRelations[]; offer: { image: string | null; title: string; subtitle: string; link: string } | null }) {
  return (
    <>
      <MiniList title="Special items" products={featured} href="/products" />
      {offer && (
        <Link href={offer.link} className="group relative block aspect-[3/4] overflow-hidden rounded-xl bg-[#14532d]">
          <ProductImage path={offer.image} alt="" sizes="250px" className="opacity-85 transition duration-700 group-hover:scale-105" />
          <span className="absolute inset-x-0 top-0 space-y-1.5 bg-[linear-gradient(180deg,rgba(0,0,0,.55),transparent)] p-5 text-center text-white">
            <b className="block font-display text-[1.3rem] uppercase leading-tight">{offer.title}</b>
            {offer.subtitle && <span className="block text-[12.5px] font-semibold uppercase">{offer.subtitle}</span>}
            <span className="inline-block rounded bg-[#fbbf24] px-3 py-1 text-[12px] font-bold uppercase text-night">Shop now</span>
          </span>
        </Link>
      )}
      <MiniList title="Recommended items" products={latest} href="/products?sort=new" />
    </>
  );
}

/** Product card with the photo on the left (category product strips). */
function SideCard({ product }: { product: ProductWithRelations }) {
  const d = info(product);
  return (
    <div className="flex h-full gap-3 rounded-xl border border-line bg-white p-3">
      <Link href={`/product/${product.slug}`} className="relative aspect-square w-[42%] shrink-0 overflow-hidden rounded-lg bg-soft">
        <ProductImage path={d.image} alt={product.name} sizes="160px" />
        {d.badge && <span className="absolute left-1.5 top-1.5 rounded bg-[#16a34a] px-1.5 py-0.5 text-[10px] font-bold text-white">{d.preorder ? 'Pre-order' : d.badge}</span>}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Link href={`/product/${product.slug}`} className="line-clamp-2 text-[13.5px] font-medium text-night hover:text-brand">{product.name}</Link>
        <p className="flex items-baseline gap-1.5"><b className="text-[15px] text-night">{formatTaka(d.min)}</b>{d.off > 0 && <s className="text-[12px] text-ink/40">{formatTaka(d.compare)}</s>}</p>
        <div className="mt-auto"><CartIconButton productId={product.id} productName={product.name} productSlug={product.slug} imagePath={d.image} price={d.min} variantId={d.single} soldOut={d.stock <= 0} look="wide" /></div>
      </div>
    </div>
  );
}

/** "Fashion & accessories": category icons on top, then sideways cards with the photo on the left. */
export function TopProducts({ title, settings, products, categories, covers }: { title: string | null; settings: SectionSettings['product_row']; products: ProductWithRelations[]; categories: Category[]; covers: Record<string, string | null> }) {
  if (!products.length) return null;
  return (
    <section className="container-page mt-8">
      <Heading href={settings.link || '/products'}>{title ?? 'Fashion & accessories'}</Heading>
      {categories.length > 1 && (
        <ul className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
          {categories.slice(0, 8).map((c) => (
            <li key={c.id} className="shrink-0">
              <Link href={`/category/${c.slug}`} className="flex w-20 flex-col items-center gap-1 rounded-xl border border-line bg-white p-2 text-center hover:border-brand">
                <span className="relative h-12 w-12 overflow-hidden rounded-lg bg-soft"><ProductImage path={pic(c, covers)} alt="" sizes="48px" /></span>
                <span className="line-clamp-1 text-[10.5px] font-semibold uppercase text-night">{c.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <AutoScroll autoplay={settings.autoplay} label={title ?? 'Products'}>
        {products.map((p) => <div key={p.id} className="w-[88%] shrink-0 snap-start sm:w-[48%] lg:w-[calc((100%-2rem)/3)]"><SideCard product={p} /></div>)}
      </AutoScroll>
    </section>
  );
}

export { Heading as TopHeading };
