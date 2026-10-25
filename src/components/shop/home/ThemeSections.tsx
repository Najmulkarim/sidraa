import Link from 'next/link';
import { Icon, type IconName } from '../../icons';
import { ProductImage } from '../ProductImage';
import { NewsletterForm } from '../NewsletterForm';
import { AutoScroll } from './AutoScroll';
import { CartIconButton } from './CartIconButton';
import { Countdown } from './Countdown';
import { isPreorder, priceRange, sellable, totalStock } from '@/lib/catalog';
import { imageUrl } from '@/lib/env';
import { discountBadge, formatTaka, toNumber } from '@/lib/format';
import { lbl, type SectionSettings, type ThemeKey } from '@/lib/home-sections';
import type { Category, ProductWithRelations, StoreSettings } from '@/lib/types';

/**
 * Home sections for the ShopEase, Luxe and NovaTrend themes. Each component
 * takes the theme and changes its look; the data is the same as Luxora's.
 */
export type ShopTheme = Exclude<ThemeKey, 'luxora'>;

function info(p: ProductWithRelations) {
  const { min } = priceRange(p);
  const compare = p.compare_at_price === null ? null : toNumber(p.compare_at_price);
  const off = compare !== null && compare > min ? Math.round((1 - min / compare) * 100) : 0;
  const active = p.variants.filter((v) => v.is_active);
  const single = active.length === 1 && !active[0]!.color && !active[0]!.size && !active[0]!.option3 ? active[0]!.id : null;
  // Keep-selling products count as in stock (a big number); pre-orders get their own tag.
  const stock = sellable(p) ? Math.max(totalStock(p), p.stock_out_mode === 'sold_out' ? 0 : 99) : 0;
  const preorder = isPreorder(p);
  return { min, compare, off, badge: preorder ? 'Pre-order' : discountBadge(min, compare, p.discount_style), stock, preorder, image: p.images[0]?.storage_path ?? null, single: preorder ? null : single };
}

export function Head({ theme, title, subtitle, href, linkLabel = 'View all' }: { theme: ShopTheme; title: string; subtitle?: string | null; href?: string | null; linkLabel?: string }) {
  const center = theme === 'shopease' && !href;
  return (
    <div className={`mb-5 flex items-end gap-4 ${center ? 'justify-center text-center' : 'justify-between'}`}>
      <div className="min-w-0">
        <h2 className={theme === 'luxe' ? 'font-display text-[1.7rem] font-semibold text-night sm:text-[2rem]' : 'font-display text-[1.45rem] font-bold tracking-tight text-night sm:text-[1.7rem]'}>{title}</h2>
        {subtitle && <p className="mt-1 text-[14px] text-ink/65">{subtitle}</p>}
      </div>
      {href && (
        <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-[13.5px] font-semibold text-brand-ink hover:underline">
          {linkLabel} <Icon name="arrow" size={15} />
        </Link>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ hero

export function ThemeHero({ theme, title, subtitle, settings, store, discount, products }: {
  theme: ShopTheme; title: string | null; subtitle: string | null; settings: SectionSettings['hero']; store: StoreSettings; discount: number; products: ProductWithRelations[];
}) {
  const slide = settings.slides.find((s) => s.image);
  const heading = slide?.title || title || store.store_name;
  const text = slide?.subtitle || subtitle || '';
  // Only products with a photo can stand in for the hero picture.
  const pictured = products.filter((p) => p.images[0]);
  const image = slide?.image ?? pictured[0]?.images[0]?.storage_path ?? null;
  const cta = { label: slide?.button || settings.button || 'Shop now', href: slide?.link || settings.link || '/products' };
  const badge = discount > 0 && (
    <span className="absolute right-3 top-3 z-10 grid h-24 w-24 place-items-center rounded-full bg-brand text-center font-bold leading-none text-white shadow-xl ring-4 ring-white/70 sm:right-6 sm:top-6 sm:h-28 sm:w-28">
      <span><span className="block text-[11px] uppercase">Up to</span><span className="block text-[28px] sm:text-[32px]">{discount}%</span><span className="block text-[11px] uppercase">off</span></span>
    </span>
  );

  if (theme === 'shopease') {
    // Two-tone heading: the part after the first comma in the logo pink.
    const [first, ...rest] = heading.split(',');
    return (
      <section className="container-page mt-5">
        <div className="relative grid overflow-hidden rounded-2xl bg-night text-white md:grid-cols-[1.1fr_1fr]">
          <span className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-brand/20 blur-3xl" aria-hidden="true" />
          <div className="relative z-10 space-y-5 p-7 sm:p-10 lg:p-14">
            <span className="inline-block rounded-md bg-white/10 px-3 py-1 text-[12px] font-semibold uppercase tracking-wide ring-1 ring-white/15">{lbl(settings, 'eyebrow', store.tagline ?? 'Limited time only')}</span>
            <h1 className="font-display text-[clamp(2.2rem,5vw,3.6rem)] font-extrabold leading-[1.05]">
              {first}{rest.length ? ',' : ''}
              {rest.length > 0 && <span className="block text-brand">{rest.join(',').trim()}</span>}
            </h1>
            {text && <p className="max-w-md text-[15.5px] text-white/80">{text}</p>}
            <ul className="flex flex-wrap gap-x-5 gap-y-3 text-[13px]">
              {([['tag', lbl(settings, 'chip1', 'Best prices'), lbl(settings, 'chip1_text', 'Every day')], ['shield', lbl(settings, 'chip2', 'Cash on delivery'), lbl(settings, 'chip2_text', 'Pay at your door')], ['truck', lbl(settings, 'chip3', 'Fast delivery'), lbl(settings, 'chip3_text', 'All over Bangladesh')]] as [IconName, string, string][]).map(([i, a, b]) => (
                <li key={a} className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-full bg-white text-night"><Icon name={i} size={17} /></span><span><b className="block font-semibold">{a}</b><span className="text-white/65">{b}</span></span></li>
              ))}
            </ul>
            <Link href={cta.href} className="btn mt-1 bg-brand text-white hover:bg-white hover:text-night">{cta.label} <Icon name="arrow" size={16} /></Link>
          </div>
          <div className="relative min-h-72 md:min-h-full">
            <ProductImage path={image} alt="" sizes="(min-width: 768px) 45vw, 100vw" priority quality={90} className="object-contain! p-6" />
            {badge}
          </div>
        </div>
      </section>
    );
  }

  if (theme === 'luxe') {
    // Last sentence in the brand colour: "Discover your style. Live luxe."
    const cut = heading.lastIndexOf('. ', heading.length - 2);
    const lead = cut > 0 ? heading.slice(0, cut + 1) : heading;
    const accent = cut > 0 ? heading.slice(cut + 2) : '';
    return (
      <section className="container-page mt-6 grid items-center gap-8 md:grid-cols-[1fr_1.15fr]">
        <div className="order-2 space-y-5 md:order-1">
          <p className="flex items-center gap-2 text-[12.5px] font-semibold uppercase tracking-[0.16em] text-brand-ink"><span aria-hidden="true">✦</span>{lbl(settings, 'eyebrow', store.tagline ?? 'New arrivals')}</p>
          <h1 className="font-display text-[clamp(2.4rem,5vw,3.9rem)] font-semibold leading-[1.06] text-night">
            {lead} {accent && <span className="text-brand">{accent}</span>}
          </h1>
          {text && <p className="max-w-sm text-[16px] text-ink/70">{text}</p>}
          <div className="flex flex-wrap gap-3">
            <Link href={cta.href} className="btn btn-primary rounded-lg">{cta.label} <Icon name="arrow" size={16} /></Link>
            <Link href="/products?sort=new" className="btn btn-dark-outline rounded-lg">{lbl(settings, 'button2', 'Explore collection')}</Link>
          </div>
        </div>
        <div className="relative order-1 aspect-[4/3] overflow-hidden rounded-3xl bg-cream md:order-2">
          <ProductImage path={image} alt="" sizes="(min-width: 768px) 55vw, 100vw" priority quality={90} />
          {badge}
        </div>
      </section>
    );
  }

  // NovaTrend: photo with real product cards floating around it.
  const floats = pictured.slice(1, 5);
  const spots = ['left-0 top-8', 'right-0 top-4', 'left-2 bottom-16', 'right-2 bottom-10'];
  return (
    <section className="relative overflow-hidden">
      <span className="pointer-events-none absolute -right-24 top-10 h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle,var(--brand),transparent_65%)] opacity-25" aria-hidden="true" />
      <div className="container-page relative grid items-center gap-8 py-10 md:grid-cols-2 md:py-14">
        <div className="space-y-5">
          <p className="text-[12.5px] font-bold uppercase tracking-[0.18em] text-brand">{lbl(settings, 'eyebrow', store.tagline ?? 'Trending now')}</p>
          <h1 className="font-display text-[clamp(2.4rem,5.2vw,4rem)] font-extrabold leading-[1.04] tracking-tight text-night">{heading}</h1>
          {text && <p className="max-w-md text-[16px] text-ink/65">{text}</p>}
          <div className="flex flex-wrap gap-3">
            <Link href={cta.href} className="btn rounded-lg bg-brand text-white hover:bg-night">{cta.label} <Icon name="arrow" size={16} /></Link>
            <Link href="/products?sort=new" className="btn btn-dark-outline rounded-lg">{lbl(settings, 'button2', 'Explore collection')}</Link>
          </div>
        </div>
        <div className="relative mx-auto aspect-square w-full max-w-lg">
          <div className="absolute inset-[8%] overflow-hidden rounded-[2.5rem] bg-cream">
            <ProductImage path={image} alt="" sizes="(min-width: 768px) 45vw, 90vw" priority quality={90} />
          </div>
          {floats.map((p, i) => {
            const d = info(p);
            return (
              <Link key={p.id} href={`/product/${p.slug}`} className={`absolute z-10 hidden w-32 animate-[float_7s_ease-in-out_infinite] rounded-xl bg-card p-2 shadow-xl ring-1 ring-line sm:block ${spots[i]}`} style={{ animationDelay: `${i * 0.8}s` }}>
                <span className="relative block aspect-square overflow-hidden rounded-lg bg-soft"><ProductImage path={d.image} alt="" sizes="128px" /></span>
                <span className="mt-1.5 line-clamp-1 block text-[12px] font-semibold text-night">{p.name}</span>
                <span className="text-[12px] font-bold text-brand">{formatTaka(d.min)}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------- benefits

export function ThemeBenefits({ theme, items }: { theme: ShopTheme; items: { icon: IconName; title: string; text: string; href: string }[] }) {
  const shown = items.slice(0, 4);
  const box = theme === 'shopease' ? 'rounded-2xl bg-cream' : theme === 'luxe' ? 'rounded-2xl bg-soft ring-1 ring-line' : 'border-y border-line';
  return (
    <section className={`container-page ${theme === 'novatrend' ? 'mt-2' : 'mt-6'}`}>
      <ul className={`grid grid-cols-2 gap-y-4 px-2 py-5 lg:grid-cols-4 lg:divide-x lg:divide-line ${box}`}>
        {shown.map((b) => (
          <li key={b.title} className="px-3">
            <Link href={b.href} className="flex items-center justify-center gap-3 max-lg:justify-start">
              <Icon name={b.icon} size={28} className={theme === 'novatrend' ? 'shrink-0 text-brand' : 'shrink-0 text-night'} />
              <span className="min-w-0">
                <span className="block text-[13.5px] font-semibold text-night">{b.title}</span>
                <span className="block text-[12.5px] text-ink/60">{b.text}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ----------------------------------------------------------- categories

export function ThemeCategories({ theme, title, categories, covers, settings }: { theme: ShopTheme; title: string | null; categories: Category[]; covers: Record<string, string | null>; settings?: SectionSettings['category_tiles'] }) {
  const tile = lbl(settings, 'tile', 'Shop now');
  if (!categories.length) return null;
  // A real product photo beats the drawn placeholder pictures of the starter categories.
  const pic = (c: Category) => (c.image_path && !c.image_path.startsWith('/demo/') ? c.image_path : covers[c.id] ?? c.image_path ?? null);
  if (theme === 'luxe') {
    return (
      <section className="container-page mt-10">
        {title && <Head theme={theme} title={title} />}
        <AutoScroll label={title ?? 'Categories'}>
          {categories.map((c) => (
            <div key={c.id} className="w-[27%] shrink-0 snap-start sm:w-24 md:w-28">
              <Link href={`/category/${c.slug}`} className="group flex flex-col items-center gap-2 text-center active:scale-95">
                <span className="relative block aspect-square w-full overflow-hidden rounded-full bg-cream ring-2 ring-transparent transition group-hover:ring-brand">
                  {imageUrl(pic(c)) ? <ProductImage path={pic(c)} alt="" sizes="112px" /> : <span className="grid h-full place-items-center font-display text-2xl text-brand/60">{c.name[0]}</span>}
                </span>
                <span className="text-[12.5px] font-medium text-night">{c.name}</span>
              </Link>
            </div>
          ))}
        </AutoScroll>
      </section>
    );
  }
  return (
    <section className="container-page mt-12">
      <Head theme={theme} title={title ?? 'Shop by category'} href={theme === 'novatrend' ? '/products' : null} linkLabel={lbl(settings, 'view_all', 'View all categories')} />
      {/* One line; when there are more than fit it slides along by itself. */}
      <AutoScroll label={title ?? 'Categories'}>
        {categories.slice(0, 16).map((c) => (
          <div key={c.id} className={`w-[44%] shrink-0 snap-start sm:w-[30%] md:w-[22%] ${theme === 'shopease' ? 'lg:w-[calc((100%-4*1rem)/5)]' : 'lg:w-[calc((100%-5*1rem)/6)]'}`}>
            <Link href={`/category/${c.slug}`} className="group block overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-line transition hover:-translate-y-0.5 hover:shadow-[var(--shadow)]">
              <span className="relative block aspect-[4/3.4] overflow-hidden bg-cream">
                {imageUrl(pic(c)) ? <ProductImage path={pic(c)} alt="" sizes="(min-width: 1024px) 18vw, 45vw" className="transition duration-500 group-hover:scale-105" /> : <span className="grid h-full place-items-center font-display text-4xl text-brand/50">{c.name[0]}</span>}
              </span>
              <span className={`flex items-center px-3 py-2.5 ${theme === 'shopease' ? 'flex-col text-center' : 'justify-between'}`}>
                <span>
                  <span className="block text-[14px] font-semibold text-night">{c.name}</span>
                  {theme === 'novatrend' && <span className="text-[12px] text-ink/55">{tile}</span>}
                </span>
                {theme === 'shopease' ? (
                  <span className="mt-0.5 inline-flex items-center gap-1 text-[12.5px] text-ink/65 group-hover:text-brand">{tile} <Icon name="arrow" size={13} /></span>
                ) : (
                  <Icon name="arrow" size={16} className="text-night transition group-hover:translate-x-0.5 group-hover:text-brand" />
                )}
              </span>
            </Link>
          </div>
        ))}
      </AutoScroll>
    </section>
  );
}

// --------------------------------------------------------- product card

export function ShopCard({ theme, product, badge }: { theme: ShopTheme; product: ProductWithRelations; badge?: string }) {
  const d = info(product);
  const tag = d.badge ?? badge;
  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-line transition hover:shadow-[var(--shadow)]">
      <Link href={`/product/${product.slug}`} className="relative block aspect-square overflow-hidden bg-soft">
        <ProductImage path={d.image} alt={product.name} sizes="(min-width: 1024px) 18vw, 45vw" className="transition duration-500 group-hover:scale-105" />
        {tag && <span className={`absolute left-2.5 top-2.5 rounded-md px-2 py-0.5 text-[11px] font-bold uppercase text-white ${d.off > 0 ? 'bg-brand' : 'bg-night'}`}>{tag}</span>}
        {d.stock <= 0 && <span className="absolute inset-x-2.5 bottom-2.5 rounded-md bg-white/90 py-1 text-center text-[11px] font-semibold uppercase text-night">Sold out</span>}
      </Link>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <Link href={`/product/${product.slug}`} className="line-clamp-1 text-[14px] font-medium text-night hover:text-brand">{product.name}</Link>
        <div className={`mt-auto flex items-center gap-2 ${theme === 'luxe' ? 'flex-col items-stretch' : 'justify-between'}`}>
          <p className="flex items-baseline gap-1.5">
            <span className="text-[15px] font-bold text-night">{formatTaka(d.min)}</span>
            {d.off > 0 && <s className="text-[12.5px] text-ink/45">{formatTaka(d.compare)}</s>}
          </p>
          <CartIconButton productId={product.id} productName={product.name} productSlug={product.slug} imagePath={d.image} price={d.min} variantId={d.single} soldOut={d.stock <= 0} look={theme === 'luxe' ? 'wide' : 'icon'} />
        </div>
      </div>
    </div>
  );
}

export function ThemeProductRow({ theme, title, subtitle, settings, products }: { theme: ShopTheme; title: string | null; subtitle: string | null; settings: SectionSettings['product_row']; products: ProductWithRelations[] }) {
  if (!products.length) return null;
  const auto = settings.source === 'new' ? 'New' : settings.source === 'featured' && theme === 'novatrend' ? 'Hot' : undefined;
  const badge = lbl(settings, 'badge', '') || auto;
  return (
    <section className="container-page mt-12">
      <Head theme={theme} title={title ?? 'Products'} subtitle={subtitle} href={settings.link || '/products'} linkLabel={lbl(settings, 'view_all', 'View all')} />
      {settings.autoplay ? (
        <AutoScroll autoplay label={title ?? 'Products'}>
          {products.map((p) => (
            <div key={p.id} className="w-[46%] shrink-0 snap-start sm:w-[31%] md:w-[23%] lg:w-[calc((100%-5*1rem)/6)]"><ShopCard theme={theme} product={p} badge={badge} /></div>
          ))}
        </AutoScroll>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => <ShopCard key={p.id} theme={theme} product={p} badge={badge} />)}
        </div>
      )}
    </section>
  );
}

/** NovaTrend "Best sellers": wide cards, photo left and details right. */
export function BestSellers({ theme, title, settings, products }: { theme: ShopTheme; title: string | null; settings: SectionSettings['collection']; products: ProductWithRelations[] }) {
  const shown = products.slice(0, settings.limit);
  if (!shown.length) return null;
  return (
    <section className="container-page mt-12">
      <Head theme={theme} title={title ?? 'Best sellers'} href={settings.link || '/products'} linkLabel={lbl(settings, 'view_all', 'View all')} />
      <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {shown.map((p) => {
          const d = info(p);
          return (
            <li key={p.id} className="grid grid-cols-[40%_1fr] gap-4 rounded-2xl bg-soft p-3 ring-1 ring-line">
              <Link href={`/product/${p.slug}`} className="relative aspect-square overflow-hidden rounded-xl bg-card"><ProductImage path={d.image} alt={p.name} sizes="200px" /></Link>
              <div className="flex min-w-0 flex-col gap-1.5 py-1">
                <span className="w-fit rounded-md bg-[#fde68a] px-2 py-0.5 text-[11px] font-bold text-night">{lbl(settings, 'badge', 'Bestseller')}</span>
                <Link href={`/product/${p.slug}`} className="line-clamp-2 text-[15px] font-semibold text-night hover:text-brand">{p.name}</Link>
                <p className="flex items-baseline gap-1.5"><span className="text-[16px] font-bold">{formatTaka(d.min)}</span>{d.off > 0 && <s className="text-[12.5px] text-ink/45">{formatTaka(d.compare)}</s>}</p>
                {p.description && <p className="line-clamp-2 text-[12.5px] text-ink/60">{p.description.replace(/[-•✓✔✅]/g, ' ').trim()}</p>}
                <div className="mt-auto"><CartIconButton productId={p.id} productName={p.name} productSlug={p.slug} imagePath={d.image} price={d.min} variantId={d.single} soldOut={d.stock <= 0} look="wide" /></div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ------------------------------------------------------------------ deal

export function Deal({ theme, title, subtitle, settings, product }: { theme: ShopTheme | 'luxora'; title: string | null; subtitle: string | null; settings: SectionSettings['deal']; product: ProductWithRelations | null }) {
  if (!product) return null;
  const d = info(product);
  const running = settings.ends_at && Date.parse(settings.ends_at) > Date.now();
  if (theme === 'novatrend') {
    return (
      <section className="container-page mt-12">
        <Link href={settings.link || `/product/${product.slug}`} className="group relative grid overflow-hidden rounded-2xl bg-[linear-gradient(115deg,var(--brand),var(--accent))] text-white md:grid-cols-[1.2fr_1fr]">
          <div className="relative z-10 space-y-3 p-7 sm:p-10">
            <p className="text-[12.5px] font-bold uppercase tracking-[0.18em] text-white/85">{settings.eyebrow || 'Flash sale'}</p>
            <h2 className="font-display text-[clamp(1.9rem,4vw,2.8rem)] font-extrabold leading-tight">{title ?? product.name}</h2>
            {subtitle && <p className="text-[15px] text-white/85">{subtitle}</p>}
            {running && <Countdown endsAt={settings.ends_at!} tone="dark" />}
            <span className="btn mt-2 w-fit bg-white text-night">{lbl(settings, 'button', 'Shop sale now')} <Icon name="arrow" size={16} /></span>
          </div>
          <div className="relative min-h-56"><ProductImage path={d.image} alt={product.name} sizes="(min-width: 768px) 40vw, 100vw" className="object-contain! p-6 transition duration-500 group-hover:scale-105" /></div>
        </Link>
      </section>
    );
  }
  const stockLine = d.stock > 0 && d.stock <= 25 ? `Only ${d.stock} item${d.stock === 1 ? '' : 's'} left!` : d.stock > 0 ? 'In stock' : 'Sold out';
  return (
    <section className="container-page mt-12">
      <div className="grid items-center gap-6 rounded-2xl bg-cream p-6 sm:p-8 md:grid-cols-2">
        <div className="space-y-3">
          <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-brand">{settings.eyebrow || 'Deal of the day'}</p>
          <h2 className="font-display text-[clamp(1.9rem,4vw,2.7rem)] font-extrabold leading-tight text-night">{title ?? 'Grab it before it’s gone!'}</h2>
          {subtitle && <p className="text-[15px] font-medium text-ink/75">{subtitle}</p>}
          <Link href={settings.link || `/product/${product.slug}`} className="btn mt-1 bg-brand text-white hover:bg-night">{lbl(settings, 'button', 'Shop the deal')} <Icon name="arrow" size={16} /></Link>
        </div>
        <Link href={`/product/${product.slug}`} className="group grid grid-cols-[42%_1fr] items-center gap-4 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-line">
          <span className="relative aspect-square overflow-hidden rounded-xl bg-soft"><ProductImage path={d.image} alt={product.name} sizes="240px" className="transition duration-500 group-hover:scale-105" /></span>
          <span className="min-w-0 space-y-2">
            <span className="line-clamp-2 block text-[17px] font-bold text-night">{product.name}</span>
            <span className="flex items-baseline gap-2"><span className="text-[22px] font-extrabold text-brand">{formatTaka(d.min)}</span>{d.off > 0 && <s className="text-[14px] text-ink/45">{formatTaka(d.compare)}</s>}</span>
            <span className="block text-[13px] font-medium text-night">{stockLine}</span>
            {d.stock > 0 && d.stock <= 25 && (
              <span className="block h-2 overflow-hidden rounded-full bg-soft"><span className="block h-full rounded-full bg-brand" style={{ width: `${Math.max(8, Math.min(100, (d.stock / 25) * 100))}%` }} /></span>
            )}
            {running && <Countdown endsAt={settings.ends_at!} />}
          </span>
        </Link>
      </div>
    </section>
  );
}

// ------------------------------------------------------------ newsletter

export function NewsletterBand({ theme, title, subtitle, settings }: { theme: ThemeKey; title: string | null; subtitle: string | null; settings?: SectionSettings['newsletter'] }) {
  const dark = theme === 'shopease' || theme === 'novatrend' || theme === 'luxora';
  return (
    <section className="container-page mt-14">
      <div className={`grid items-center gap-5 rounded-2xl px-6 py-7 sm:px-10 md:grid-cols-[1.2fr_1fr] ${dark ? 'bg-night text-white' : 'bg-[linear-gradient(105deg,var(--cream),color-mix(in_oklab,var(--accent)_25%,white))] text-night'}`}>
        <div className="flex items-center gap-4">
          <span className={`hidden h-14 w-14 shrink-0 place-items-center rounded-2xl sm:grid ${dark ? 'bg-brand text-white' : 'bg-card text-brand shadow'}`}><Icon name="mail" size={26} /></span>
          <div>
            <h2 className="font-display text-[1.45rem] font-bold leading-tight">{title ?? 'Get exclusive offers & updates'}</h2>
            {subtitle && <p className={`mt-1 text-[14px] ${dark ? 'text-white/70' : 'text-ink/70'}`}>{subtitle}</p>}
          </div>
        </div>
        <NewsletterForm tone={dark ? 'dark' : 'light'} buttonLabel={lbl(settings, 'button', 'Subscribe')} placeholder={lbl(settings, 'placeholder', 'Enter your email')} />
      </div>
    </section>
  );
}

// -------------------------------------------------------------- banners

export function ThemeBanners({ theme, eyebrow, settings, images }: { theme: ShopTheme; eyebrow: string | null; settings: SectionSettings['banners']; images: string[] }) {
  const items = settings.items.filter((b) => b.image || b.title);
  if (!items.length) return null;
  const tints = ['bg-cream', 'bg-[#e8eef6]', 'bg-[color-mix(in_oklab,var(--accent)_22%,white)]'];
  if (theme === 'novatrend' && items.length === 1) {
    const b = items[0]!;
    return (
      <section className="container-page mt-12">
        <Link href={b.link || '/products'} className="group relative grid min-h-64 overflow-hidden rounded-2xl bg-night text-white md:grid-cols-2">
          <div className="relative z-10 space-y-3 p-7 sm:p-10">
            {eyebrow && <p className="text-[12.5px] font-bold uppercase tracking-[0.18em] text-white/70">{eyebrow}</p>}
            {b.title && <h2 className="font-display text-[clamp(1.9rem,4vw,2.6rem)] font-extrabold leading-tight">{b.title}</h2>}
            {b.subtitle && <p className="max-w-sm text-[15px] text-white/75">{b.subtitle}</p>}
            <span className="btn mt-2 w-fit bg-white text-night">{lbl(settings, 'button', 'Shop collection')}</span>
          </div>
          <div className="relative min-h-56"><ProductImage path={b.image ?? images[0] ?? null} alt="" sizes="(min-width: 768px) 50vw, 100vw" className="opacity-90 transition duration-700 group-hover:scale-105" /></div>
        </Link>
      </section>
    );
  }
  return (
    <section className="container-page mt-10">
      <AutoScroll label="Offers">
        {items.map((b, i) => (
          <div key={i} className={`shrink-0 snap-start ${items.length === 1 ? 'w-full' : items.length === 2 ? 'w-[86%] md:w-[calc((100%-1rem)/2)]' : 'w-[86%] md:w-[calc((100%-2rem)/3)]'}`}>
            <Link href={b.link || '/products'} className={`group grid h-full min-h-44 grid-cols-[1.1fr_1fr] overflow-hidden rounded-2xl ${tints[i % tints.length]}`}>
              <span className="flex flex-col justify-center gap-1.5 p-5">
                {b.title && <span className="font-display text-[1.35rem] font-semibold leading-tight text-night">{b.title}</span>}
                {b.subtitle && <span className="text-[13px] text-ink/65">{b.subtitle}</span>}
                <span className="mt-1 inline-flex items-center gap-1 text-[13px] font-semibold text-night group-hover:text-brand">{lbl(settings, 'button', 'Shop now')} <Icon name="arrow" size={14} /></span>
              </span>
              <span className="relative"><ProductImage path={b.image ?? images[i] ?? images[0] ?? null} alt="" sizes="(min-width: 768px) 16vw, 45vw" className="transition duration-500 group-hover:scale-105" /></span>
            </Link>
          </div>
        ))}
      </AutoScroll>
    </section>
  );
}

// --------------------------------------------------------- testimonials

export function ReviewCards({ theme, title, settings }: { theme: ShopTheme; title: string | null; settings: SectionSettings['testimonials'] }) {
  const reviews = settings.items.filter((r) => r.quote && r.name);
  if (!reviews.length) return null;
  return (
    <section className="container-page mt-14">
      <div className="text-center"><Head theme={theme} title={title ?? 'What our customers say'} /></div>
      <ul className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-3 md:px-0">
        {reviews.slice(0, 6).map((r, i) => (
          <li key={i} className="w-[85%] shrink-0 snap-start rounded-2xl bg-card p-5 shadow-sm ring-1 ring-line md:w-auto">
            <div className="flex gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-cream font-display text-lg font-semibold text-brand">{r.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</span>
              <div className="min-w-0">
                <p className="text-[14px] leading-relaxed text-ink/80">{r.quote}</p>
                <p className="mt-2 text-[14px] tracking-[0.15em] text-brand" aria-label={`${r.rating} out of 5 stars`}>{'★'.repeat(r.rating)}<span className="text-line">{'★'.repeat(5 - r.rating)}</span></p>
                <p className="text-[14px] font-semibold text-night">{r.name}{r.place && <span className="font-normal text-ink/55"> · {r.place}</span>}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// --------------------------------------------------------- product grid

/** Boutique card for the "All products" grid: tall photo, second photo on hover, quiet details. */
function GridCard({ product, serif }: { product: ProductWithRelations; serif: boolean }) {
  const d = info(product);
  const second = product.images[1]?.storage_path;
  const colours = new Set(product.variants.filter((v) => v.is_active && v.color).map((v) => v.color)).size;
  return (
    <article className="group">
      <Link href={`/product/${product.slug}`} className="relative block aspect-[3/4] overflow-hidden rounded-xl bg-soft">
        <ProductImage path={d.image} alt={product.name} sizes="(min-width: 1024px) 19vw, (min-width: 640px) 31vw, 48vw" className={`transition duration-700 ${second ? 'group-hover:opacity-0' : 'group-hover:scale-105'}`} />
        {second && <ProductImage path={second} alt="" sizes="(min-width: 1024px) 19vw, 48vw" className="opacity-0 transition duration-700 group-hover:scale-105 group-hover:opacity-100" />}
        {d.badge && d.stock > 0 && <span className="absolute left-2.5 top-2.5 rounded-full bg-brand px-2.5 py-1 text-[10.5px] font-bold tracking-wide text-white shadow">{d.badge}</span>}
        {d.stock <= 0 && <span className="absolute inset-x-0 bottom-0 bg-night/75 py-1.5 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-white">Sold out</span>}
        {d.stock > 0 && (
          <span className="absolute inset-x-3 bottom-3 hidden translate-y-2 rounded-full bg-white/95 py-2.5 text-center text-[11.5px] font-semibold uppercase tracking-[0.16em] text-night opacity-0 shadow-lg backdrop-blur transition duration-300 group-hover:translate-y-0 group-hover:opacity-100 md:block">
            Choose options
          </span>
        )}
      </Link>
      <div className="mt-3 space-y-0.5 px-0.5">
        {product.category && <p className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-ink/45">{product.category.name}</p>}
        <Link href={`/product/${product.slug}`} className={`line-clamp-1 text-night transition hover:text-brand ${serif ? 'font-display text-[1.12rem] font-semibold' : 'text-[14.5px] font-medium'}`}>{product.name}</Link>
        <p className="flex items-baseline gap-2">
          <span className="text-[15px] font-semibold text-night">{formatTaka(d.min)}</span>
          {d.badge && <s className="text-[12.5px] text-ink/40">{formatTaka(d.compare)}</s>}
          {colours > 1 && <span className="ml-auto text-[11.5px] text-ink/50">{colours} colours</span>}
        </p>
      </div>
    </article>
  );
}

/** "All products": centred heading, category chips, five-to-a-line boutique grid and a View all button. */
export function ProductGridSection({ theme, title, subtitle, link, button, products, categories = [] }: {
  theme: ThemeKey; title: string | null; subtitle: string | null; link: string; button: string; products: ProductWithRelations[]; categories?: Category[];
}) {
  if (!products.length) return null;
  const serif = theme === 'luxora' || theme === 'luxe';
  return (
    <section className="reveal container-page mt-16">
      <div className="mb-8 text-center">
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.28em] text-brand">Shop the collection</p>
        <h2 className={`mt-1.5 font-display text-night ${serif ? 'text-[clamp(2rem,3.6vw,2.8rem)] font-semibold' : 'text-[1.7rem] font-bold tracking-tight sm:text-[2rem]'}`}>{title ?? 'All products'}</h2>
        {subtitle && <p className="mx-auto mt-2 max-w-xl text-[14.5px] text-ink/65">{subtitle}</p>}
        <span className="mx-auto mt-4 block h-px w-16 bg-brand/40" aria-hidden="true" />
        {categories.length > 1 && (
          <nav aria-label="Categories" className="-mx-4 mt-5 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:flex-wrap sm:justify-center [&::-webkit-scrollbar]:hidden">
            <Link href={link || '/products'} className="shrink-0 snap-start rounded-full bg-night px-4 py-2 text-[12.5px] font-semibold text-white">All</Link>
            {categories.map((c) => (
              <Link key={c.id} href={`/category/${c.slug}`} className="shrink-0 snap-start rounded-full px-4 py-2 text-[12.5px] font-semibold text-ink ring-1 ring-line transition hover:bg-tint hover:text-brand-ink hover:ring-brand/40">{c.name}</Link>
            ))}
          </nav>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 sm:gap-x-5 md:grid-cols-4 lg:grid-cols-5">
        {products.map((p) => <GridCard key={p.id} product={p} serif={serif} />)}
      </div>
      <div className="mt-10 text-center">
        <Link href={link || '/products'} className="btn btn-dark-outline rounded-full px-9">{button} <Icon name="arrow" size={16} /></Link>
      </div>
    </section>
  );
}
