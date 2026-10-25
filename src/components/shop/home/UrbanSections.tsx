import Link from 'next/link';
import { lbl, type SectionSettings } from '@/lib/home-sections';
import { formatTaka } from '@/lib/format';
import type { Category, ProductWithRelations, StoreSettings } from '@/lib/types';
import { Icon, type IconName } from '../../icons';
import { ProductImage } from '../ProductImage';
import { CartIconButton } from './CartIconButton';
import { info } from './ThemeSections';

/**
 * "Urban" home theme: clean city look — a full-width photo hero with a dark
 * overlay, centred uppercase headings, plain product cards with a dark
 * button, photo category tiles, a wide sale banner and trust badges.
 */

const pic = (c: Category, covers: Record<string, string | null>) => (c.image_path && !c.image_path.startsWith('/demo/') ? c.image_path : covers[c.id] ?? c.image_path ?? null);

function Title({ children }: { children: string }) {
  return <h2 className="mb-6 text-center font-display text-[1.45rem] font-extrabold uppercase tracking-wide text-night sm:text-[1.7rem]">{children}</h2>;
}

export function UrbanHero({ title, subtitle, settings, store, products }: {
  title: string | null; subtitle: string | null; settings: SectionSettings['hero']; store: StoreSettings; products: ProductWithRelations[];
}) {
  const slide = settings.slides.find((s) => s.image);
  const image = slide?.image ?? products.find((p) => p.images[0])?.images[0]?.storage_path ?? null;
  const heading = slide?.title || title || store.store_name;
  return (
    <section className="relative min-h-[26rem] overflow-hidden bg-night md:min-h-[32rem]">
      <ProductImage path={image} alt="" sizes="100vw" priority quality={90} className="object-[center_8%] opacity-90" />
      <span className="absolute inset-0 bg-[linear-gradient(90deg,rgba(15,18,32,.78),rgba(15,18,32,.25)_60%,transparent)]" aria-hidden="true" />
      <div className="container-page relative flex min-h-[26rem] flex-col justify-center gap-4 py-12 text-white md:min-h-[32rem]">
        <p className="text-[13px] font-semibold uppercase tracking-[0.2em] text-white/85">{lbl(settings, 'eyebrow', store.tagline ?? 'New season')}</p>
        <h1 className="max-w-xl font-display text-[clamp(2.1rem,4.6vw,3.4rem)] font-extrabold leading-[1.08]">{heading}</h1>
        {(slide?.subtitle || subtitle) && <p className="max-w-md text-[15.5px] text-white/85">{slide?.subtitle || subtitle}</p>}
        <div className="flex flex-wrap gap-3 pt-1">
          <Link href={slide?.link || settings.link || '/products'} className="btn rounded-md bg-brand px-6 text-white hover:bg-white hover:text-night">{slide?.button || settings.button || 'Shop now'}</Link>
          <Link href="/products?sort=new" className="btn rounded-md bg-brand/90 px-6 text-white hover:bg-white hover:text-night">{lbl(settings, 'button2', 'New arrivals')}</Link>
        </div>
      </div>
    </section>
  );
}

function Card({ product, badge }: { product: ProductWithRelations; badge?: string }) {
  const d = info(product);
  return (
    <div className="group flex h-full flex-col text-center">
      <Link href={`/product/${product.slug}`} className="relative block aspect-[4/5] overflow-hidden bg-[#efefef]">
        <ProductImage path={d.image} alt={product.name} sizes="(min-width: 1024px) 22vw, 46vw" className="transition duration-500 group-hover:scale-105" />
        {(d.badge || badge) && <span className="absolute right-2 top-2 grid h-7 min-w-7 place-items-center rounded-full bg-brand px-1.5 text-[10.5px] font-bold text-white">{d.badge ?? badge}</span>}
      </Link>
      <Link href={`/product/${product.slug}`} className="mt-2.5 line-clamp-1 text-[14px] font-semibold text-night hover:text-brand">{product.name}</Link>
      <p className="text-[14px] font-bold text-night">{formatTaka(d.min)}{d.off > 0 && <s className="ml-1.5 text-[12px] font-normal text-ink/40">{formatTaka(d.compare)}</s>}</p>
      <div className="mt-2 flex justify-center"><CartIconButton productId={product.id} productName={product.name} productSlug={product.slug} imagePath={d.image} price={d.min} variantId={d.single} soldOut={d.stock <= 0} look="wide" /></div>
    </div>
  );
}

export function UrbanProducts({ title, settings, products }: { title: string | null; settings: SectionSettings['product_row']; products: ProductWithRelations[] }) {
  if (!products.length) return null;
  const shown = products.length > 4 ? products.slice(0, Math.floor(products.length / 4) * 4) : products;
  return (
    <section className="container-page mt-14">
      <Title>{title ?? 'New arrivals'}</Title>
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">{shown.map((p) => <Card key={p.id} product={p} badge={lbl(settings, 'badge', '') || undefined} />)}</div>
      <div className="mt-8 text-center"><Link href={settings.link || '/products'} className="text-[13.5px] font-bold uppercase tracking-wide text-night underline-offset-4 hover:text-brand hover:underline">{lbl(settings, 'view_all', 'View all')} →</Link></div>
    </section>
  );
}

export function UrbanCategories({ title, categories, covers }: { title: string | null; categories: Category[]; covers: Record<string, string | null> }) {
  if (!categories.length) return null;
  return (
    <section className="container-page mt-14">
      <Title>{title ?? 'Shop by category'}</Title>
      <ul className={`mx-auto grid max-w-5xl grid-cols-2 gap-4 ${categories.length === 5 ? 'md:grid-cols-5' : categories.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-4'}`}>
        {categories.slice(0, 8).map((c) => (
          <li key={c.id}>
            <Link href={`/category/${c.slug}`} className="group relative block aspect-[4/3.6] overflow-hidden bg-night">
              <ProductImage path={pic(c, covers)} alt="" sizes="(min-width: 768px) 22vw, 46vw" className="opacity-80 transition duration-700 group-hover:scale-105 group-hover:opacity-70" />
              <span className="absolute inset-0 grid place-items-center p-3 text-center font-display text-[clamp(1rem,1.8vw,1.35rem)] font-extrabold uppercase leading-tight text-white drop-shadow">{c.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function UrbanBanner({ settings, images }: { settings: SectionSettings['banners']; images: string[] }) {
  const b = settings.items.find((x) => x.image || x.title);
  if (!b) return null;
  return (
    <section className="container-page mt-14">
      <Link href={b.link || '/products'} className="group relative mx-auto grid min-h-40 max-w-5xl place-items-center overflow-hidden bg-night px-6 py-8 text-center text-white">
        <ProductImage path={b.image ?? images[0] ?? null} alt="" sizes="(min-width: 1024px) 64rem, 100vw" className="opacity-45 transition duration-700 group-hover:scale-105" />
        <span className="relative space-y-3">
          {b.title && <b className="block font-display text-[clamp(1.4rem,3vw,2.1rem)] font-extrabold uppercase">{b.title}</b>}
          {b.subtitle && <span className="block text-[14px] text-white/85">{b.subtitle}</span>}
          <span className="btn rounded-md bg-brand px-6 text-white group-hover:bg-white group-hover:text-night">{lbl(settings, 'button', 'Shop sale')}</span>
        </span>
      </Link>
    </section>
  );
}

export function UrbanTrust({ title, items }: { title: string | null; items: { icon: IconName; title: string; text: string; href: string }[] }) {
  return (
    <section className="mt-16 bg-[#f1f2f4] py-10">
      <div className="container-page">
        <Title>{title ?? 'Why shop with us'}</Title>
        <ul className="mx-auto grid max-w-5xl grid-cols-2 gap-6 md:grid-cols-4">
          {items.slice(0, 4).map((b) => (
            <li key={b.title}>
              <Link href={b.href} className="flex items-center justify-center gap-3 text-left">
                <Icon name={b.icon} size={30} className="shrink-0 text-night" />
                <span className="leading-tight"><b className="block text-[13.5px] uppercase text-night">{b.title}</b><span className="text-[12.5px] text-ink/60">{b.text}</span></span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
