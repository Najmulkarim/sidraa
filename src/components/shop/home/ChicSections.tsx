import Link from 'next/link';
import { lbl, type SectionSettings } from '@/lib/home-sections';
import { formatTaka } from '@/lib/format';
import type { Category, ProductWithRelations, StoreSettings } from '@/lib/types';
import { Icon, type IconName } from '../../icons';
import { ProductImage } from '../ProductImage';
import { AutoScroll } from './AutoScroll';
import { CartIconButton } from './CartIconButton';
import { Head, info } from './ThemeSections';

/**
 * "Chic" home theme: soft cream page, hero photo on a big brand-colour
 * circle, a benefits card over the hero, pastel category cards with item
 * counts, product cards with colour dots and an offer band.
 */

const TINTS = ['#fdeef0', '#fdf3e4', '#e9f3ec', '#fdecec', '#f2eaf6', '#e8f0fa'];

/** Colour names as written in the admin → a dot colour (unknown names get a neutral grey). */
const DOT: Record<string, string> = {
  black: '#1f1f1f', white: '#ffffff', red: '#d62839', maroon: '#7b1e2b', pink: '#f4a6bd', purple: '#7b4bb3', violet: '#7b4bb3',
  blue: '#2f6fd6', navy: '#1f2f5a', 'navy blue': '#1f2f5a', green: '#2e8b57', yellow: '#f2c230', golden: '#c9a227', gold: '#c9a227',
  grey: '#9aa0a6', gray: '#9aa0a6', brown: '#7a4b2a', beige: '#e8d9c0', cream: '#f4ead5', orange: '#f08a24', peach: '#f6b49a',
};
function dot(name: string): string {
  const n = name.trim().toLowerCase();
  if (DOT[n]) return DOT[n]!;
  if (n.startsWith('multi') || n.includes('print')) return 'conic-gradient(#e30363, #f2c230, #2f6fd6, #2e8b57, #e30363)';
  const word = Object.keys(DOT).find((k) => n.includes(k));
  return word ? DOT[word]! : '#c9c9cf';
}

/** "Stylish Looks. Everyday You." → the last word in the brand colour. */
function splitHeading(h: string): [string, string] {
  const t = h.trim();
  const i = t.lastIndexOf(' ');
  return i > 0 ? [t.slice(0, i), t.slice(i + 1)] : ['', t];
}

export function ChicHero({ title, subtitle, settings, store, products, total }: {
  title: string | null; subtitle: string | null; settings: SectionSettings['hero']; store: StoreSettings; products: ProductWithRelations[]; total: number;
}) {
  const slide = settings.slides.find((s) => s.image);
  const heading = slide?.title || title || store.store_name;
  const text = slide?.subtitle || subtitle || '';
  const pictured = products.filter((p) => p.images[0]);
  const image = slide?.image ?? pictured[0]?.images[0]?.storage_path ?? null;
  const [lead, last] = splitHeading(heading);
  const faces = pictured.slice(1, 4);
  return (
    <section className="relative overflow-hidden bg-[color-mix(in_oklab,var(--cream)_80%,white)]">
      <span className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-brand/5 blur-3xl" aria-hidden="true" />
      <div className="container-page relative grid items-center gap-8 pb-24 pt-8 md:grid-cols-[1fr_1.05fr] md:pb-28 md:pt-12">
        <div className="space-y-5">
          <p className="inline-flex items-center gap-2 rounded-full bg-tint px-3.5 py-1.5 text-[12px] font-bold uppercase tracking-[0.12em] text-brand-ink">
            <span aria-hidden="true">✿</span>{lbl(settings, 'eyebrow', 'New collection')}
          </p>
          <h1 className="font-display text-[clamp(2.6rem,5.6vw,4.4rem)] font-bold leading-[1.04] text-night">
            {lead} <span className="text-brand">{last}</span>
          </h1>
          {text && <p className="max-w-md text-[16.5px] leading-relaxed text-ink/70">{text}</p>}
          <div className="flex flex-wrap gap-3">
            <Link href={slide?.link || settings.link || '/products'} className="btn rounded-lg bg-brand px-6 text-white shadow-[0_12px_24px_-12px_var(--brand)] hover:bg-night">
              {slide?.button || settings.button || 'Shop now'} <Icon name="arrow" size={16} />
            </Link>
            <Link href="/products?sort=new" className="btn rounded-lg border-[1.5px] border-brand/40 bg-white px-6 text-night hover:border-brand">{lbl(settings, 'button2', 'Explore collections')}</Link>
          </div>
        </div>

        <div className="relative mx-auto aspect-square w-full max-w-[34rem]">
          <span className="absolute right-0 top-[4%] aspect-square w-[86%] rounded-full bg-brand/85" aria-hidden="true" />
          {/* Leaf line drawing on the circle. */}
          <svg viewBox="0 0 120 160" className="absolute right-[3%] top-[10%] w-[24%] text-white/70" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
            <path d="M60 155 C60 110 62 60 75 10" />
            {[30, 55, 80, 105, 128].map((y, i) => (
              <g key={y}>
                <path d={`M${62 + i} ${y + 12} C${45 - i * 2} ${y + 8} ${35 - i} ${y - 4} ${30 - i} ${y - 14} C${45} ${y - 10} ${56} ${y} ${62 + i} ${y + 12}Z`} />
                <path d={`M${64 + i} ${y + 4} C${82 + i} ${y} ${92 + i} ${y - 10} ${96 + i} ${y - 22} C${84} ${y - 18} ${70} ${y - 8} ${64 + i} ${y + 4}Z`} />
              </g>
            ))}
          </svg>
          <div className="absolute bottom-0 left-[14%] right-[20%] top-[2%] overflow-hidden rounded-t-[999px]">
            <ProductImage path={image} alt="" sizes="(min-width: 768px) 42vw, 90vw" priority quality={90} />
          </div>
          {faces.length > 0 && (
            <div className="absolute bottom-[6%] left-0 flex items-center gap-3 rounded-2xl bg-white/95 px-3.5 py-2.5 shadow-[0_18px_40px_-16px_rgba(0,0,0,.35)] backdrop-blur">
              <span className="flex -space-x-2.5">
                {faces.map((p) => (
                  <span key={p.id} className="relative h-9 w-9 overflow-hidden rounded-full ring-2 ring-white"><ProductImage path={p.images[0]!.storage_path} alt="" sizes="36px" /></span>
                ))}
              </span>
              <span className="leading-tight">
                <b className="block text-[13.5px] text-night">{total} styles in the shop</b>
                <span className="text-[12px] text-ink/60">Cash on delivery all over Bangladesh</span>
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function ChicBenefits({ items, overlap }: { items: { icon: IconName; title: string; text: string; href: string }[]; overlap: boolean }) {
  return (
    <section className={`container-page relative z-10 ${overlap ? '-mt-14' : 'mt-14'}`}>
      <ul className="grid grid-cols-2 gap-y-5 rounded-2xl bg-white px-3 py-5 shadow-[0_20px_50px_-24px_rgba(40,10,30,.35)] ring-1 ring-line lg:grid-cols-4 lg:divide-x lg:divide-line">
        {items.slice(0, 4).map((b) => (
          <li key={b.title} className="px-3">
            <Link href={b.href} className="flex items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-tint text-brand"><Icon name={b.icon} size={22} /></span>
              <span className="min-w-0">
                <span className="block text-[14px] font-semibold text-night">{b.title}</span>
                <span className="block text-[12.5px] text-ink/60">{b.text}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ChicCategories({ title, categories, covers, counts, settings }: {
  title: string | null; categories: Category[]; covers: Record<string, string | null>; counts: Record<string, number>; settings?: SectionSettings['category_tiles'];
}) {
  if (!categories.length) return null;
  const pic = (c: Category) => (c.image_path && !c.image_path.startsWith('/demo/') ? c.image_path : covers[c.id] ?? c.image_path ?? null);
  return (
    <section className="container-page mt-14">
      <Head theme="novatrend" title={title ?? 'Shop by Category'} href="/products" linkLabel={lbl(settings, 'view_all', 'View all categories')} />
      <AutoScroll label={title ?? 'Categories'}>
        {categories.slice(0, 16).map((c, i) => (
          <div key={c.id} className="w-[78%] shrink-0 snap-start sm:w-[46%] md:w-[31%] lg:w-[calc((100%-4*1rem)/5)]">
            <Link href={`/category/${c.slug}`} className="group grid h-36 grid-cols-[46%_1fr] overflow-hidden rounded-2xl transition hover:-translate-y-0.5 hover:shadow-[var(--shadow)]" style={{ background: TINTS[i % TINTS.length] }}>
              <span className="relative"><ProductImage path={pic(c)} alt="" sizes="140px" className="transition duration-500 group-hover:scale-105" /></span>
              <span className="flex flex-col justify-center gap-1 p-3">
                <b className="text-[15px] leading-tight text-night">{c.name}</b>
                {counts[c.id] ? <span className="text-[12px] text-ink/55">{counts[c.id]} item{counts[c.id] === 1 ? '' : 's'}</span> : null}
                <Icon name="arrow" size={16} className="mt-1 text-night transition group-hover:translate-x-1 group-hover:text-brand" />
              </span>
            </Link>
          </div>
        ))}
      </AutoScroll>
    </section>
  );
}

function ChicCard({ product, badge }: { product: ProductWithRelations; badge?: string }) {
  const d = info(product);
  const colours = [...new Set(product.variants.filter((v) => v.is_active && v.color).map((v) => v.color))].slice(0, 5);
  const tag = d.badge ?? badge;
  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-line transition hover:ring-2 hover:ring-brand/50 hover:shadow-[var(--shadow)]">
      <Link href={`/product/${product.slug}`} className="relative block aspect-[4/5] overflow-hidden bg-[color-mix(in_oklab,var(--cream)_70%,white)]">
        <ProductImage path={d.image} alt={product.name} sizes="(min-width: 1024px) 24vw, 48vw" className="transition duration-500 group-hover:scale-105" />
        {tag && <span className="absolute left-3 top-3 rounded-md bg-brand px-2.5 py-1 text-[11px] font-bold text-white shadow">{tag}</span>}
        {d.stock <= 0 && <span className="absolute inset-x-3 bottom-3 rounded-md bg-white/90 py-1 text-center text-[11px] font-semibold uppercase text-night">Sold out</span>}
      </Link>
      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <Link href={`/product/${product.slug}`} className="line-clamp-1 text-[14.5px] font-semibold text-night hover:text-brand">{product.name}</Link>
        <p className="flex items-baseline gap-2">
          <span className="text-[16px] font-bold text-brand">{formatTaka(d.min)}</span>
          {d.off > 0 && <s className="text-[12.5px] text-ink/40">{formatTaka(d.compare)}</s>}
        </p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <span className="flex gap-1.5">
            {colours.map((c) => <span key={c} title={c} className="h-4 w-4 rounded-full ring-1 ring-black/10" style={{ background: dot(c) }} />)}
          </span>
          <CartIconButton productId={product.id} productName={product.name} productSlug={product.slug} imagePath={d.image} price={d.min} variantId={d.single} soldOut={d.stock <= 0} look="icon" />
        </div>
      </div>
    </div>
  );
}

export function ChicProductRow({ title, subtitle, settings, products }: { title: string | null; subtitle: string | null; settings: SectionSettings['product_row']; products: ProductWithRelations[] }) {
  if (!products.length) return null;
  const badge = lbl(settings, 'badge', '') || (settings.source === 'new' ? 'New' : undefined);
  return (
    <section className="container-page mt-14">
      <Head theme="novatrend" title={title ?? 'New Arrivals'} subtitle={subtitle} href={settings.link || '/products'} linkLabel={lbl(settings, 'view_all', 'View all products')} />
      <AutoScroll autoplay={settings.autoplay} label={title ?? 'Products'}>
        {products.map((p) => (
          <div key={p.id} className="w-[47%] shrink-0 snap-start sm:w-[31%] md:w-[calc((100%-3*1rem)/4)]"><ChicCard product={p} badge={badge} /></div>
        ))}
      </AutoScroll>
    </section>
  );
}

export function ChicOffer({ eyebrow, settings, images }: { eyebrow: string | null; settings: SectionSettings['banners']; images: string[] }) {
  const b = settings.items.find((x) => x.image || x.title);
  if (!b) return null;
  return (
    <section className="container-page mt-14">
      <Link href={b.link || '/products'} className="group relative grid min-h-48 items-center overflow-hidden rounded-3xl bg-[linear-gradient(110deg,var(--brand),color-mix(in_oklab,var(--brand)_65%,var(--accent)))] text-white md:grid-cols-[auto_1fr_1fr]">
        <span className="ml-6 mt-6 hidden h-28 w-28 shrink-0 place-items-center rounded-full border-2 border-dashed border-white/70 p-3 text-center text-[13px] font-bold leading-tight md:ml-8 md:mt-0 md:grid">
          {eyebrow ?? 'Limited time offer'}
        </span>
        <span className="relative z-10 space-y-2 p-6 md:p-8">
          {eyebrow && <span className="block text-[12px] font-bold uppercase tracking-[0.18em] text-white/80 md:hidden">{eyebrow}</span>}
          {b.title && <span className="block font-display text-[clamp(1.8rem,3.6vw,2.6rem)] font-bold leading-tight">{b.title}</span>}
          {b.subtitle && <span className="block max-w-md text-[15px] text-white/85">{b.subtitle}</span>}
          <span className="btn mt-2 w-fit rounded-lg bg-white text-night group-hover:bg-night group-hover:text-white">{lbl(settings, 'button', 'Grab the deal')} <Icon name="arrow" size={16} /></span>
        </span>
        <span className="relative hidden h-full min-h-48 md:block">
          <ProductImage path={b.image ?? images[0] ?? null} alt="" sizes="(min-width: 768px) 40vw, 100vw" className="opacity-95 transition duration-700 group-hover:scale-105" />
          <span className="absolute inset-0 bg-[linear-gradient(90deg,color-mix(in_oklab,var(--brand)_90%,transparent),transparent_45%)]" aria-hidden="true" />
        </span>
      </Link>
    </section>
  );
}
