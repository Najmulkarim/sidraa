import Link from 'next/link';
import type { ReactNode } from 'react';
import { lbl, type SectionSettings } from '@/lib/home-sections';
import { formatTaka } from '@/lib/format';
import type { Category, ProductWithRelations, StoreSettings } from '@/lib/types';
import { Icon, type IconName } from '../../icons';
import { NewsletterForm } from '../NewsletterForm';
import { ProductImage } from '../ProductImage';
import { AutoScroll } from './AutoScroll';
import { CartIconButton } from './CartIconButton';
import { NovaSlides, NovaTabs } from './NovaClient';
import { info } from './ThemeSections';

/**
 * "Nova" home theme: navy and orange editorial store — a full-width photo
 * hero with a coloured word, category circles beside a heading, split
 * banners, favourites with tabs, "complete the look", a story band and a
 * style gallery. Colours come from --nova / --nova-ink (globals.css).
 */

type Benefit = { icon: IconName; title: string; text: string; href: string };
const pic = (c: Category, covers: Record<string, string | null>) => (c.image_path && !c.image_path.startsWith('/demo/') ? c.image_path : covers[c.id] ?? c.image_path ?? null);
const script = 'font-[family-name:var(--f-script)]';

function Eyebrow({ children, light = false }: { children: ReactNode; light?: boolean }) {
  return (
    <p className={`flex items-center gap-2 whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.2em] ${light ? 'text-white/80' : 'text-ink/55'}`}>
      <span className="h-[2px] w-6 bg-[var(--nova)]" aria-hidden="true" />{children}
    </p>
  );
}

function Title({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <h2 className={`font-display text-[clamp(1.55rem,2.6vw,2.1rem)] font-semibold leading-tight text-[var(--nova-ink)] ${className}`}>{children}</h2>;
}

function More({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="inline-flex shrink-0 items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-[var(--nova-ink)] hover:text-[var(--nova)]">{children} <Icon name="arrow" size={14} /></Link>;
}

/** The heading with `highlight` (a part of it) in orange; by default the last two words. */
function Highlighted({ text, highlight }: { text: string; highlight: string }) {
  const words = text.split(/\s+/);
  const part = highlight || (words.length > 2 ? words.slice(-2).join(' ') : '');
  const at = part ? text.toLowerCase().lastIndexOf(part.toLowerCase()) : -1;
  if (at < 0) return <>{text}</>;
  return <>{text.slice(0, at)}<span className="text-[var(--nova)]">{text.slice(at, at + part.length)}</span>{text.slice(at + part.length)}</>;
}

// ------------------------------------------------------------------ hero

export function NovaHero({ title, subtitle, settings, store, products, benefits }: {
  title: string | null; subtitle: string | null; settings: SectionSettings['hero']; store: StoreSettings; products: ProductWithRelations[]; benefits: Benefit[];
}) {
  const own = settings.slides.filter((s) => s.image);
  const fallback = products.find((p) => p.images[0])?.images[0]?.storage_path ?? null;
  const slides = own.length ? own : [{ image: fallback, title: '', subtitle: '', button: '', link: '' }];
  const scriptLine = lbl(settings, 'script', 'Style that feels like you');
  return (
    <NovaSlides
      slides={slides.map((s, n) => (
        <div key={n} className="relative flex min-h-[34rem] items-end text-white md:min-h-[33rem] md:items-center">
          <ProductImage path={s.image} alt="" sizes="100vw" priority={n === 0} quality={90} className="object-[70%_15%] md:object-[center_20%]" />
          <span className="absolute inset-0 bg-[linear-gradient(0deg,var(--nova-ink)_8%,rgba(20,27,43,.55)_55%,rgba(20,27,43,.1))] md:bg-[linear-gradient(90deg,var(--nova-ink)_5%,rgba(20,27,43,.8)_35%,rgba(20,27,43,.05)_68%)]" aria-hidden="true" />
          {scriptLine && <span className={`absolute right-[7%] top-[18%] hidden max-w-[12rem] -rotate-6 text-[2rem] leading-tight text-white/90 lg:block ${script}`} aria-hidden="true">{scriptLine}</span>}
          <div className="container-page relative w-full py-10 md:py-16">
            <div className="max-w-xl space-y-4">
              <p className="text-[11.5px] font-semibold uppercase tracking-[0.24em] text-white/85">{lbl(settings, 'eyebrow', store.tagline ?? 'New collection')}</p>
              {n === 0 ? (
                <h1 className="font-display text-[clamp(2.3rem,5.4vw,4rem)] font-semibold leading-[1.04]"><Highlighted text={s.title || title || store.store_name} highlight={lbl(settings, 'highlight', '')} /></h1>
              ) : (
                <p className="font-display text-[clamp(2.3rem,5.4vw,4rem)] font-semibold leading-[1.04]"><Highlighted text={s.title || title || store.store_name} highlight={lbl(settings, 'highlight', '')} /></p>
              )}
              {(s.subtitle || subtitle) && <p className="max-w-md text-[15px] text-white/80">{s.subtitle || subtitle}</p>}
              <Link href={s.link || settings.link || '/products'} className="btn mt-1 rounded-sm bg-[var(--nova)] px-6 text-[12.5px] uppercase tracking-[0.14em] text-white hover:bg-white hover:text-[var(--nova-ink)]">
                {s.button || settings.button || 'Shop now'} <Icon name="arrow" size={15} />
              </Link>
              <ul className="grid grid-cols-3 gap-3 pt-5 sm:max-w-lg">
                {benefits.slice(0, 3).map((b) => (
                  <li key={b.title} className="flex items-center gap-2.5">
                    <Icon name={b.icon} size={22} className="shrink-0 text-white/85" />
                    <span className="text-[11px] leading-tight text-white/75 sm:text-[12px]"><b className="block font-semibold text-white">{b.title}</b>{b.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ))}
    />
  );
}

// ------------------------------------------------------------ categories

export function NovaCategories({ title, settings, categories, covers }: { title: string | null; settings: SectionSettings['category_tiles']; categories: Category[]; covers: Record<string, string | null> }) {
  if (!categories.length) return null;
  return (
    <section className="container-page mt-10 grid items-center gap-5 lg:grid-cols-[14rem_1fr] lg:gap-8">
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1 lg:block lg:space-y-2">
        <div className="space-y-2">
          <Eyebrow>{lbl(settings, 'eyebrow', 'Shop by category')}</Eyebrow>
          <Title>{title ?? 'Find your style'}</Title>
        </div>
        <div className="whitespace-nowrap lg:pt-2"><More href="/products">{lbl(settings, 'view_all', 'View all categories')}</More></div>
      </div>
      <div className="min-w-0">
        <AutoScroll label="Categories">
          {categories.slice(0, 12).map((c) => (
            <div key={c.id} className="w-[26%] shrink-0 snap-start sm:w-[18%] lg:w-[calc((100%-7*1rem)/8)]">
              <Link href={`/category/${c.slug}`} className="group block text-center">
                <span className="relative block aspect-square overflow-hidden rounded-full bg-[#f3efea]">
                  <ProductImage path={pic(c, covers)} alt="" sizes="140px" className="transition duration-500 group-hover:scale-110" />
                </span>
                <span className="mt-2 line-clamp-1 block text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--nova-ink)] group-hover:text-[var(--nova)]">{c.name}</span>
              </Link>
            </div>
          ))}
        </AutoScroll>
      </div>
    </section>
  );
}

// --------------------------------------------------------------- banners

/** One or two banners: a navy card with the photo on the left, and a photo with the text over it. */
function Split({ settings, items, images }: { settings: SectionSettings['banners']; items: SectionSettings['banners']['items']; images: string[] }) {
  return (
    <section className={`container-page mt-10 grid gap-4 ${items.length > 1 ? 'md:grid-cols-2' : ''}`}>
      {items.slice(0, 2).map((b, i) => {
        const eyebrow = lbl(settings, `eyebrow${i + 1}`, '');
        const button = lbl(settings, `button${i + 1}`, lbl(settings, 'button', 'Shop now'));
        const text = (
          <span className="relative z-10 flex flex-col justify-center gap-2.5 p-6 sm:p-8">
            {eyebrow && <span className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-white/75">{eyebrow}</span>}
            {b.title && <b className="font-display text-[clamp(1.5rem,2.6vw,2.1rem)] font-semibold leading-tight">{b.title}</b>}
            {b.subtitle && <span className="max-w-xs text-[13.5px] text-white/75">{b.subtitle}</span>}
            <span className="mt-1 inline-flex w-fit items-center gap-2 border border-white/70 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] transition group-hover:bg-white group-hover:text-[var(--nova-ink)]">{button} <Icon name="arrow" size={13} /></span>
          </span>
        );
        return i === 0 ? (
          <Link key={i} href={b.link || '/products'} className="group grid min-h-64 grid-cols-[45%_1fr] overflow-hidden bg-[var(--nova-ink)] text-white">
            <span className="relative overflow-hidden"><ProductImage path={b.image ?? images[0] ?? null} alt="" sizes="(min-width: 768px) 22vw, 45vw" className="transition duration-700 group-hover:scale-105" /></span>
            {text}
          </Link>
        ) : (
          <Link key={i} href={b.link || '/products'} className="group relative flex min-h-64 justify-end overflow-hidden bg-[var(--nova)] text-white">
            <ProductImage path={b.image ?? images[1] ?? null} alt="" sizes="(min-width: 768px) 50vw, 100vw" className="transition duration-700 group-hover:scale-105" />
            <span className="absolute inset-0 bg-[linear-gradient(270deg,rgba(20,27,43,.75),rgba(20,27,43,.15)_75%)]" aria-hidden="true" />
            <span className="relative w-full max-w-[60%]">{text}</span>
          </Link>
        );
      })}
    </section>
  );
}

/** Three or more: small cards with the photo on the left (style links). */
function Journal({ title, settings, items, images }: { title: string | null; settings: SectionSettings['banners']; items: SectionSettings['banners']['items']; images: string[] }) {
  return (
    <section className="container-page mt-14">
      <div className="mb-5 space-y-2">
        <Eyebrow>{lbl(settings, 'eyebrow', 'The style journal')}</Eyebrow>
        <Title>{title ?? 'Style & inspiration'}</Title>
      </div>
      <ul className="grid gap-4 md:grid-cols-3">
        {items.slice(0, 3).map((b, i) => (
          <li key={i}>
            <Link href={b.link || '/products'} className="group grid h-full grid-cols-[40%_1fr] overflow-hidden border border-line bg-white">
              <span className="relative aspect-[4/3.4] overflow-hidden bg-[#f3efea]"><ProductImage path={b.image ?? images[i + 3] ?? images[i] ?? null} alt="" sizes="(min-width: 768px) 13vw, 40vw" className="transition duration-700 group-hover:scale-105" /></span>
              <span className="flex flex-col justify-center gap-1.5 p-4">
                {lbl(settings, `eyebrow${i + 1}`, '') && <span className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[var(--nova)]">{lbl(settings, `eyebrow${i + 1}`, '')}</span>}
                {b.title && <b className="font-display text-[1.05rem] font-semibold leading-snug text-[var(--nova-ink)]">{b.title}</b>}
                {b.subtitle && <span className="line-clamp-2 text-[12.5px] text-ink/60">{b.subtitle}</span>}
                <span className="mt-1 inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[var(--nova-ink)] group-hover:text-[var(--nova)]">{lbl(settings, `button${i + 1}`, lbl(settings, 'button', 'Shop now'))} <Icon name="arrow" size={13} /></span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function NovaBanners({ title, settings, images }: { title: string | null; settings: SectionSettings['banners']; images: string[] }) {
  const items = settings.items.filter((b) => b.image || b.title);
  if (!items.length) return null;
  return items.length >= 3 ? <Journal title={title} settings={settings} items={items} images={images} /> : <Split settings={settings} items={items} images={images} />;
}

// -------------------------------------------------------------- products

/** Colour dots from the product's options (names a browser knows show their colour; others show grey). */
function Dots({ product }: { product: ProductWithRelations }) {
  const colours = [...new Set(product.variants.filter((v) => v.is_active && v.color).map((v) => v.color as string))].slice(0, 4);
  if (colours.length < 2) return null;
  return (
    <span className="mt-1.5 flex gap-1.5" aria-label={`Colours: ${colours.join(', ')}`}>
      {colours.map((c) => <span key={c} title={c} className="h-3 w-3 rounded-full bg-[#cfc8c0] ring-1 ring-black/10" style={{ background: c.toLowerCase().replace(/\s+/g, '') }} />)}
    </span>
  );
}

export function NovaCard({ product, badge, tall = false }: { product: ProductWithRelations; badge?: string; tall?: boolean }) {
  const d = info(product);
  const tag = d.badge ?? badge;
  return (
    <div className="group">
      <div className={`relative overflow-hidden bg-[#f3f1ee] ${tall ? 'aspect-[3/4]' : 'aspect-[4/5]'}`}>
        <Link href={`/product/${product.slug}`} className="absolute inset-0" aria-label={product.name}>
          <ProductImage path={d.image} alt={product.name} sizes="(min-width: 1024px) 16vw, 46vw" className="transition duration-700 group-hover:scale-105" />
        </Link>
        {tag && d.stock > 0 && <span className="pointer-events-none absolute bottom-2 left-2 bg-[var(--nova-ink)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">{tag}</span>}
        {d.stock <= 0 && <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-[var(--nova-ink)]/80 py-1 text-center text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white">Sold out</span>}
        <span className="absolute right-2 top-2 rounded-lg md:opacity-0 md:transition md:group-hover:opacity-100 md:focus-within:opacity-100">
          <CartIconButton productId={product.id} productName={product.name} productSlug={product.slug} imagePath={d.image} price={d.min} variantId={d.single} soldOut={d.stock <= 0} look="icon" />
        </span>
      </div>
      <Link href={`/product/${product.slug}`} className="mt-2.5 line-clamp-1 text-[13px] text-[var(--nova-ink)] hover:text-[var(--nova)]">{product.name}</Link>
      <p className="flex items-baseline gap-1.5"><b className="text-[13.5px] font-semibold text-[var(--nova-ink)]">{formatTaka(d.min)}</b>{d.off > 0 && <s className="text-[11.5px] text-ink/40">{formatTaka(d.compare)}</s>}</p>
      <Dots product={product} />
    </div>
  );
}

const row = (products: ProductWithRelations[], label: string, badge?: string) => (
  <AutoScroll autoplay={false} label={label}>
    {products.map((p) => <div key={p.id} className="w-[44%] shrink-0 snap-start sm:w-[30%] lg:w-[calc((100%-5*1rem)/6)]"><NovaCard product={p} badge={badge} /></div>)}
  </AutoScroll>
);

/** "Our favourites": this section's products, newest and on sale, as tabs. */
export function NovaFavourites({ title, settings, products, latest, onSale }: { title: string | null; settings: SectionSettings['product_row']; products: ProductWithRelations[]; latest: ProductWithRelations[]; onSale: ProductWithRelations[] }) {
  if (!products.length) return null;
  const name = title ?? 'Our favourites';
  const tabs = [
    { label: lbl(settings, 'tab1', 'Best sellers'), list: products },
    { label: lbl(settings, 'tab2', 'New in'), list: latest },
    { label: lbl(settings, 'tab3', 'Special price'), list: onSale },
  ].filter((t) => t.list.length);
  return (
    <section className="container-page mt-14">
      <NovaTabs
        head={<div className="space-y-2"><Eyebrow>{lbl(settings, 'eyebrow', 'Featured products')}</Eyebrow><Title>{name}</Title></div>}
        tabs={tabs.map((t) => ({ label: t.label, content: row(t.list, `${name}: ${t.label}`, lbl(settings, 'badge', '') || undefined) }))}
      />
    </section>
  );
}

/** "Fresh pieces": full rows of tall photo cards with a NEW tag. */
export function NovaGrid({ title, settings, products }: { title: string | null; settings: SectionSettings['product_row']; products: ProductWithRelations[] }) {
  if (!products.length) return null;
  const shown = products.length > 6 ? products.slice(0, Math.floor(products.length / 6) * 6) : products;
  return (
    <section className="container-page mt-14">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div className="space-y-2"><Eyebrow>{lbl(settings, 'eyebrow', 'New arrivals')}</Eyebrow><Title>{title ?? 'Fresh pieces'}</Title></div>
        <More href={settings.link || '/products?sort=new'}>{lbl(settings, 'view_all', 'View all')}</More>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-6">
        {shown.map((p) => <NovaCard key={p.id} product={p} tall badge={lbl(settings, 'badge', 'New')} />)}
      </div>
    </section>
  );
}

/** "Complete the look": text, a photo, then the pieces joined by plus signs. */
export function NovaLook({ title, subtitle, settings, products }: { title: string | null; subtitle: string | null; settings: SectionSettings['collection']; products: ProductWithRelations[] }) {
  if (!products.length) return null;
  const items = products.slice(0, 5);
  const photo = settings.image ?? products.find((p) => p.images[1])?.images[1]?.storage_path ?? items[0]?.images[0]?.storage_path ?? null;
  return (
    <section className="container-page mt-14">
      <div className="grid gap-4 bg-[#f6f3ef] p-4 sm:p-6 lg:grid-cols-[13rem_14rem_1fr] lg:items-center lg:gap-6">
        <div className="grid grid-cols-[1fr_40%] gap-4 lg:contents">
          <div className="flex flex-col justify-center gap-2.5">
            <Eyebrow>{lbl(settings, 'eyebrow', 'Shop the look')}</Eyebrow>
            <Title>{title ?? 'Complete the look'}</Title>
            {subtitle && <p className="text-[13.5px] text-ink/65">{subtitle}</p>}
            <Link href={settings.link || '/products'} className="btn btn-sm mt-1 w-fit rounded-sm bg-[var(--nova)] text-[11.5px] uppercase tracking-[0.14em] text-white hover:bg-[var(--nova-ink)]">{lbl(settings, 'button', 'Explore looks')} <Icon name="arrow" size={13} /></Link>
          </div>
          <span className="relative block aspect-[4/5] overflow-hidden bg-white lg:aspect-[3/4]"><ProductImage path={photo} alt="" sizes="(min-width: 1024px) 14rem, 40vw" /></span>
        </div>
        <ul className="-mx-4 flex snap-x items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0 [&::-webkit-scrollbar]:hidden">
          {items.map((p, i) => {
            const d = info(p);
            return (
              <li key={p.id} className="flex shrink-0 snap-start items-center gap-2 lg:min-w-0 lg:flex-1 lg:shrink">
                {i > 0 && <Icon name="plus" size={16} className="shrink-0 text-ink/40" />}
                <Link href={`/product/${p.slug}`} className="group block w-28 lg:w-full">
                  <span className="relative block aspect-square overflow-hidden bg-white"><ProductImage path={d.image} alt={p.name} sizes="140px" className="transition duration-500 group-hover:scale-105" /></span>
                  <span className="mt-1.5 line-clamp-1 block text-[12px] text-[var(--nova-ink)] group-hover:text-[var(--nova)]">{p.name}</span>
                  <b className="text-[12.5px] text-[var(--nova-ink)]">{formatTaka(d.min)}</b>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

// ----------------------------------------------------------- story band

export function NovaStory({ title, text, settings, image }: { title: string | null; text: string | null; settings: SectionSettings['about']; image: string | null }) {
  const scriptLine = lbl(settings, 'script', 'Fashion · People · Possibilities');
  return (
    <section className="relative mt-14 flex min-h-[24rem] items-end overflow-hidden bg-[var(--nova-ink)] text-white md:items-center">
      <ProductImage path={settings.image ?? image} alt="" sizes="100vw" className="object-[70%_20%]" />
      <span className="absolute inset-0 bg-[linear-gradient(0deg,var(--nova-ink)_10%,rgba(20,27,43,.4))] md:bg-[linear-gradient(90deg,var(--nova-ink)_8%,rgba(20,27,43,.75)_38%,rgba(20,27,43,.05)_70%)]" aria-hidden="true" />
      {scriptLine && <span className={`absolute right-[8%] top-1/2 hidden max-w-[13rem] -translate-y-1/2 -rotate-6 text-[1.9rem] leading-tight text-white/90 lg:block ${script}`} aria-hidden="true">{scriptLine}</span>}
      <div className="container-page relative w-full py-10">
        <div className="max-w-md space-y-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/80">{lbl(settings, 'eyebrow', 'More than fashion')}</p>
          <h2 className="font-display text-[clamp(1.9rem,4vw,2.9rem)] font-semibold leading-[1.08]">{title ?? 'Our story'}</h2>
          {text && <p className="text-[14px] leading-relaxed text-white/80">{text}</p>}
          {settings.link_label && <Link href={settings.link || '/products'} className="btn btn-sm w-fit rounded-sm bg-[var(--nova)] text-[11.5px] uppercase tracking-[0.14em] text-white hover:bg-white hover:text-[var(--nova-ink)]">{settings.link_label} <Icon name="arrow" size={13} /></Link>}
        </div>
      </div>
    </section>
  );
}

// -------------------------------------------------------------- the rest

export function NovaBenefits({ items }: { items: Benefit[] }) {
  return (
    <section className="border-b border-line bg-[#f6f3ef]">
      <ul className="container-page grid grid-cols-2 gap-y-5 py-6 md:grid-cols-4 md:divide-x md:divide-line">
        {items.slice(0, 4).map((b) => (
          <li key={b.title} className="flex justify-center px-2">
            <Link href={b.href} className="flex items-center gap-3">
              <Icon name={b.icon} size={26} className="shrink-0 text-[var(--nova-ink)]" />
              <span className="text-[12px] leading-tight text-ink/60"><b className="block text-[13px] font-semibold text-[var(--nova-ink)]">{b.title}</b>{b.text}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Customer comments — only the ones the shop entered; nothing shows without them. */
export function NovaReviews({ title, settings }: { title: string | null; settings: SectionSettings['testimonials'] }) {
  const reviews = settings.items.filter((r) => r.quote && r.name);
  if (!reviews.length) return null;
  return (
    <section className="container-page mt-14">
      <div className="mb-5 space-y-2"><Eyebrow>{lbl(settings, 'eyebrow', 'Customer love')}</Eyebrow><Title>{title ?? 'Real people, real stories'}</Title></div>
      <AutoScroll autoplay={false} label="Customer comments">
        {reviews.slice(0, 9).map((r, i) => (
          <figure key={i} className="flex w-[86%] shrink-0 snap-start gap-4 border border-line bg-white p-5 sm:w-[48%] lg:w-[calc((100%-2rem)/3)]">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[color-mix(in_oklab,var(--nova)_15%,white)] font-display text-lg font-semibold text-[var(--nova)]">{r.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</span>
            <div className="min-w-0">
              <p className="text-[13px] tracking-[0.15em] text-[var(--nova)]" aria-label={`${r.rating} out of 5 stars`}>{'★'.repeat(r.rating)}<span className="text-line">{'★'.repeat(5 - r.rating)}</span></p>
              <blockquote className="mt-1.5 text-[13.5px] leading-relaxed text-ink/75">“{r.quote}”</blockquote>
              <figcaption className="mt-2 text-[12.5px] font-semibold text-[var(--nova-ink)]">— {r.name}{r.place && <span className="font-normal text-ink/50">, {r.place}</span>}</figcaption>
            </div>
          </figure>
        ))}
      </AutoScroll>
    </section>
  );
}

export function NovaGallery({ title, settings, fallback }: { title: string | null; settings: SectionSettings['gallery']; fallback: { image: string; link: string }[] }) {
  const own = settings.images.filter((g) => g.image) as { image: string; link: string }[];
  const base = own.length ? own : fallback;
  if (!base.length) return null;
  const tiles = Array.from({ length: Math.min(8, Math.max(base.length, 4)) }, (_, i) => base[i % base.length]!);
  return (
    <section className="container-page mt-14">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
          <div className="space-y-2"><Eyebrow>{lbl(settings, 'eyebrow', 'Our looks')}</Eyebrow><Title>{title ?? 'Style gallery'}</Title></div>
          {settings.handle && <p className="pb-1 text-[13px] text-ink/60">Tag <b className="text-[var(--nova-ink)]">{settings.handle}</b> to be featured</p>}
        </div>
        <More href={settings.handle_link || '/products'}>{lbl(settings, 'view_all', 'View gallery')}</More>
      </div>
      <ul className="grid grid-cols-4 gap-1.5 lg:grid-cols-8">
        {tiles.map((g, i) => (
          <li key={i}>
            <Link href={g.link || '/products'} className="group relative block aspect-square overflow-hidden bg-[#f3efea]">
              <ProductImage path={g.image} alt="" sizes="(min-width: 1024px) 12.5vw, 25vw" className="transition duration-700 group-hover:scale-110" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function NovaNewsletter({ title, subtitle, settings, store }: { title: string | null; subtitle: string | null; settings: SectionSettings['newsletter']; store: StoreSettings }) {
  return (
    <section className="relative mt-14 overflow-hidden bg-[var(--nova-ink)] text-white">
      <span className="absolute -left-16 -top-20 h-56 w-56 rounded-full bg-[var(--nova)]/25 blur-3xl" aria-hidden="true" />
      <span className="absolute -bottom-24 right-10 h-56 w-56 rounded-full bg-[var(--nova)]/20 blur-3xl" aria-hidden="true" />
      <div className="container-page relative grid items-center gap-5 py-9 md:grid-cols-[1.2fr_1fr]">
        <div>
          <h2 className="font-display text-[clamp(1.4rem,2.6vw,1.9rem)] font-semibold">{title ?? `Join the ${store.store_name} insider list`}</h2>
          {subtitle && <p className="mt-1 text-[13.5px] text-white/70">{subtitle}</p>}
        </div>
        <div className="[&_button]:bg-[var(--nova)] [&_button]:text-white [&_button:hover]:bg-white [&_button:hover]:text-[var(--nova-ink)]">
          <NewsletterForm tone="dark" buttonLabel={lbl(settings, 'button', 'Subscribe')} placeholder={lbl(settings, 'placeholder', 'Your email address')} />
        </div>
      </div>
    </section>
  );
}
