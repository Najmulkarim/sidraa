import Link from 'next/link';
import { Icon, type IconName } from '@/components/icons';
import { ProductRow } from '@/components/shop/ProductCard';
import { getCategories, getFeaturedProducts, getNewArrivals, getOnSale, getSettings, getZones, maxDiscount } from '@/lib/catalog';
import { imageUrl, SITE_URL } from '@/lib/env';
import { formatTaka } from '@/lib/format';

// Statically cached; admin saves call revalidatePath('/', 'layout').
export const revalidate = 300;

function SectionHead({ title, href }: { title: string; href?: string }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <h2 className="section-title">{title}</h2>
      {href && (
        <Link href={href} className="flex items-center gap-1 text-[12px] font-semibold uppercase tracking-wide text-ink hover:text-brand">
          View all <Icon name="arrow" size={15} />
        </Link>
      )}
    </div>
  );
}

export default async function HomePage() {
  const [settings, categories, zones, featured, latest, sale] = await Promise.all([
    getSettings(),
    getCategories(),
    getZones(),
    getFeaturedProducts(10),
    getNewArrivals(10),
    getOnSale(10),
  ]);

  const discount = maxDiscount([...sale, ...featured, ...latest]);
  const freeOver = zones.map((z) => (z.free_over === null ? null : Number(z.free_over))).filter((n): n is number => n !== null);
  const fastest = zones[0]?.eta_text;
  const bySlug = (slug: string) => categories.find((c) => c.slug === slug);

  // Benefit cards: every line here is something the shop actually does.
  const benefits: { icon: IconName; title: string; text: string; href: string; bg: string }[] = [
    { icon: 'cash', title: 'Cash on delivery', text: 'Pay when it reaches you', href: '/info/delivery', bg: 'linear-gradient(120deg,var(--brand),var(--accent))' },
    {
      icon: 'truck',
      title: freeOver.length ? `Free delivery over ${formatTaka(Math.min(...freeOver))}` : 'Delivery all over Bangladesh',
      text: fastest ? `Inside Dhaka in ${fastest}` : 'Fast, trackable delivery',
      href: '/info/delivery',
      bg: 'linear-gradient(120deg,var(--plum),var(--brand))',
    },
    { icon: 'eye', title: 'Check before paying', text: 'Open the parcel with the rider', href: '/info/delivery', bg: 'linear-gradient(120deg,var(--night),var(--plum))' },
    { icon: 'return', title: `${settings.return_policy_days}-day returns`, text: 'Wrong size? We will sort it', href: '/info/returns', bg: 'linear-gradient(120deg,var(--plum),var(--brand) 60%,var(--accent))' },
  ];

  const promos = [
    { title: bySlug('dresses') ? 'Dresses' : 'New in', text: 'Light, breezy & beautiful', href: bySlug('dresses') ? '/category/dresses' : '/products', image: '/demo/promo-1.svg', bg: 'linear-gradient(120deg,var(--plum),var(--brand))' },
    { title: 'New arrivals', text: 'Fresh styles just for you', href: '/products?sort=new', image: '/demo/promo-2.svg', bg: 'linear-gradient(120deg,var(--night),var(--plum))' },
    { title: bySlug('ethnic-wear') ? 'Ethnic wear' : 'On sale', text: 'Shine on every occasion', href: bySlug('ethnic-wear') ? '/category/ethnic-wear' : '/products', image: '/demo/promo-3.svg', bg: 'linear-gradient(120deg,var(--brand),var(--accent))' },
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'OnlineStore',
    name: settings.store_name,
    url: SITE_URL,
    ...(settings.tagline ? { description: settings.tagline } : {}),
    ...(settings.phone ? { telephone: settings.phone } : {}),
    ...(settings.email ? { email: settings.email } : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />

      {/* Hero */}
      <section className="relative overflow-hidden text-white" style={{ background: 'var(--hero)' }}>
        <span className="pointer-events-none absolute -left-24 top-10 h-72 w-72 animate-[float_9s_ease-in-out_infinite] rounded-full bg-accent/25 blur-3xl" aria-hidden="true" />
        <span className="pointer-events-none absolute -right-10 bottom-0 h-80 w-80 animate-[float_12s_ease-in-out_infinite_reverse] rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
        <div className="container-page relative grid items-center gap-6 pb-24 pt-10 md:grid-cols-[1.1fr_1fr] md:pb-28 md:pt-14">
          <div className="relative z-10 space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-block rounded-full border border-white/70 bg-white/15 px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.12em]">
                {settings.tagline ?? 'New season'}
              </span>
              {/* Phones don't show the hero art, so the discount rides here. */}
              {discount > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[12px] font-bold uppercase text-brand shadow-lg md:hidden">
                  <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand/60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-brand" /></span>
                  Up to {discount}% off
                </span>
              )}
            </div>
            <h1 className="font-display text-[clamp(2.25rem,5.2vw,3.75rem)] font-medium leading-[1.08]">
              Elevate your
              <span className="block text-[color-mix(in_oklab,var(--accent)_35%,white)]">everyday style</span>
            </h1>
            <p className="max-w-sm text-[15px] text-white/90">Fashion for every mood and moment. Order in a minute, pay in cash at your door.</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/products" className="btn btn-light">Shop now</Link>
              <Link href="/products?sort=new" className="btn btn-glass">Explore new in</Link>
            </div>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 pt-2 text-[12.5px]">
              {[
                ['cash', 'Cash on delivery'],
                ['return', `${settings.return_policy_days}-day returns`],
                ['shield', 'Check before you pay'],
              ].map(([icon, text]) => (
                <li key={text} className="flex items-center gap-2 font-medium">
                  <Icon name={icon as IconName} size={17} /> {text}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative mx-auto hidden w-full max-w-md md:block">
            <div className="relative mx-auto aspect-[4/5] w-[78%] overflow-hidden rounded-t-full bg-white/15 ring-1 ring-white/30">
              <img src="/demo/hero-1.svg" alt="" className="h-full w-full object-cover" />
            </div>
            {discount > 0 && (
              <span className="absolute right-0 top-10 grid h-28 w-28 place-items-center rounded-full bg-[radial-gradient(circle,var(--brand),var(--plum))] text-center font-bold leading-none shadow-xl ring-4 ring-white/80">
                <span>
                  <span className="block text-[11px] uppercase">Up to</span>
                  <span className="block text-[30px]">{discount}%</span>
                  <span className="block text-[11px] uppercase">off</span>
                </span>
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Benefit cards overlapping the hero */}
      <section className="container-page relative z-10 -mt-14">
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {benefits.map((b) => (
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

      {/* Categories */}
      {categories.length > 0 && (
        <section className="reveal container-page mt-14">
          <SectionHead title="Shop by category" href="/products" />
          <ul className="-mx-4 flex snap-x scroll-px-4 justify-start gap-5 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:mx-0 md:justify-between md:px-0">
            {categories.map((c) => (
              <li key={c.id} className="snap-start">
                <Link href={`/category/${c.slug}`} className="group flex w-24 flex-col items-center gap-3 text-center transition active:scale-95 sm:w-28">
                  <span className="relative block aspect-square w-full overflow-hidden rounded-full bg-[radial-gradient(circle,white,var(--tint))] ring-2 ring-[color-mix(in_oklab,var(--brand)_18%,white)] transition group-hover:ring-brand">
                    {imageUrl(c.image_path) ? (
                      <img src={imageUrl(c.image_path)!} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                    ) : (
                      <span className="grid h-full place-items-center font-display text-3xl text-brand/60">{c.name[0]}</span>
                    )}
                  </span>
                  <span className="text-[12px] font-semibold uppercase tracking-wide group-hover:text-brand">{c.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {featured.length > 0 && (
        <section className="reveal container-page mt-14">
          <SectionHead title="Trending now" href="/products" />
          <ProductRow products={featured} />
        </section>
      )}

      {/* Promo banners */}
      <section className="reveal container-page mt-14 grid gap-4 md:grid-cols-3">
        {promos.map((p) => (
          <Link key={p.title} href={p.href} className="group relative flex min-h-44 items-center overflow-hidden rounded-xl p-6 text-white" style={{ background: p.bg }}>
            <span className="relative z-10 max-w-[55%] space-y-2">
              <span className="block text-[20px] font-bold uppercase leading-tight">{p.title}</span>
              <span className="block text-[12px] text-white/85">{p.text}</span>
              <span className="mt-2 inline-flex rounded-md bg-white px-3 py-1.5 text-[12px] font-bold uppercase text-brand">Shop now</span>
            </span>
            <img src={p.image} alt="" className="absolute inset-y-0 right-0 h-full w-[55%] object-cover transition duration-500 [mask-image:linear-gradient(90deg,transparent,black_45%)] group-hover:scale-105" />
          </Link>
        ))}
      </section>

      {latest.length > 0 && (
        <section className="reveal container-page mt-14">
          <SectionHead title="New arrivals" href="/products?sort=new" />
          <ProductRow products={latest} badge="New" />
        </section>
      )}

      {/* Features strip */}
      <section className="reveal container-page mt-14">
        <ul className="grid gap-px overflow-hidden rounded-xl bg-white/10 sm:grid-cols-2 lg:grid-cols-4" style={{ background: 'linear-gradient(110deg,var(--night),var(--plum))' }}>
          {[
            { icon: 'cash' as const, title: 'Cash on delivery', text: 'No card or account needed' },
            { icon: 'return' as const, title: 'Easy returns', text: `${settings.return_policy_days}-day return & exchange` },
            { icon: 'shield' as const, title: 'Check before you pay', text: 'Open the parcel with the rider' },
            { icon: 'truck' as const, title: 'Fast delivery', text: fastest ? `Inside Dhaka in ${fastest}` : 'To your doorstep' },
          ].map((f) => (
            <li key={f.title} className="flex items-center gap-3 px-6 py-5 text-white">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/25 text-accent"><Icon name={f.icon} size={21} /></span>
              <span>
                <span className="block text-[12.5px] font-bold uppercase">{f.title}</span>
                <span className="block text-[12px] text-white/70">{f.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {sale.length > 0 && (
        <section className="reveal container-page mt-14">
          <SectionHead title="On sale" href="/products?sort=price-asc" />
          <ProductRow products={sale} />
        </section>
      )}

      {featured.length === 0 && latest.length === 0 && (
        <section className="container-page mt-16 text-center text-muted">
          <p>No products are published yet. Add some in the admin panel.</p>
        </section>
      )}
    </>
  );
}
