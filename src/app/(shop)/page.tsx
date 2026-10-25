import type { IconName } from '@/components/icons';
import { About, Banners, Benefits, CategoryTiles, Collection, HeroSection, Notice, ProductRowSection, QuickLinks } from '@/components/shop/home/Sections';
import {
  getCategories, getCategoryProducts, getFeaturedProducts, getHomeSections, getNewArrivals, getOnSale, getProductsByIds, getSettings, getZones, maxDiscount,
  type HomeSectionRow,
} from '@/lib/catalog';
import { SITE_URL } from '@/lib/env';
import { formatTaka } from '@/lib/format';
import { parseSettings, SECTION_TYPES, type SectionSettings, type SectionType } from '@/lib/home-sections';
import type { ProductWithRelations } from '@/lib/types';

// Statically cached; admin saves call revalidatePath('/', 'layout').
export const revalidate = 300;

/** Used until the home_sections table exists (migration 0016) or if it cannot be read. */
const FALLBACK: HomeSectionRow[] = [
  { id: 'hero', type: 'hero', title: 'Elevate your everyday style', subtitle: 'Fashion for every mood and moment. Order in a minute, pay in cash at your door.', enabled: true, sort_order: 10, settings: {} },
  { id: 'benefits', type: 'benefits', title: null, subtitle: null, enabled: true, sort_order: 20, settings: {} },
  { id: 'cats', type: 'category_tiles', title: 'Shop by category', subtitle: null, enabled: true, sort_order: 30, settings: {} },
  { id: 'trend', type: 'collection', title: 'Trending now', subtitle: null, enabled: true, sort_order: 40, settings: { source: 'featured', limit: 7 } },
  { id: 'new', type: 'product_row', title: 'New arrivals', subtitle: null, enabled: true, sort_order: 50, settings: { source: 'new', limit: 10, link: '/products?sort=new' } },
  { id: 'sale', type: 'collection', title: 'On sale', subtitle: null, enabled: true, sort_order: 60, settings: { source: 'sale', limit: 7, link: '/products?sort=price-asc' } },
];

type ProductList = SectionSettings['collection'] | SectionSettings['product_row'];

/** The products a collection / slider asks for, one extra for the blurred "View more" tile. */
function productsFor(s: ProductList): Promise<ProductWithRelations[]> {
  const n = s.limit + 1;
  switch (s.source) {
    case 'manual': return getProductsByIds(s.product_ids.slice(0, n));
    case 'new': return getNewArrivals(n);
    case 'sale': return getOnSale(n);
    case 'category': return s.category_id ? getCategoryProducts(s.category_id, n) : Promise.resolve([]);
    default: return getFeaturedProducts(n);
  }
}

export default async function HomePage() {
  const [settings, categories, zones, rows] = await Promise.all([getSettings(), getCategories(), getZones(), getHomeSections()]);

  const sections = (rows ?? FALLBACK)
    .filter((r): r is HomeSectionRow & { type: SectionType } => (SECTION_TYPES as readonly string[]).includes(r.type))
    .map((r) => ({ ...r, settings: parseSettings(r.type, r.settings) }));

  // Fetch every section's products at once.
  const lists = await Promise.all(sections.map((s) => (s.type === 'collection' || s.type === 'product_row' ? productsFor(s.settings as ProductList) : Promise.resolve([]))));
  const discount = maxDiscount(lists.flat());

  const freeOver = zones.map((z) => (z.free_over === null ? null : Number(z.free_over))).filter((n): n is number => n !== null);
  const fastest = zones[0]?.eta_text;
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

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'OnlineStore',
    name: settings.store_name,
    url: SITE_URL,
    ...(settings.tagline ? { description: settings.tagline } : {}),
    ...(settings.phone ? { telephone: settings.phone } : {}),
    ...(settings.email ? { email: settings.email } : {}),
  };

  const isGradientHero = (i: number) => sections[i]?.type === 'hero' && !(sections[i]!.settings as SectionSettings['hero']).slides.some((s) => s.image);
  const hasH1 = sections.some((s) => s.type === 'hero');

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      {/* A slider hero has no visible <h1>; keep one for search engines and screen readers. */}
      {(!hasH1 || !isGradientHero(sections.findIndex((s) => s.type === 'hero'))) && <h1 className="sr-only">{settings.store_name}</h1>}

      {sections.map((s, i) => {
        const key = s.id;
        switch (s.type) {
          case 'hero':
            return <HeroSection key={key} title={s.title} subtitle={s.subtitle} settings={s.settings as SectionSettings['hero']} store={settings} discount={discount} overlap={sections[i + 1]?.type === 'benefits' && isGradientHero(i)} />;
          case 'quick_links':
            return <QuickLinks key={key} settings={s.settings as SectionSettings['quick_links']} />;
          case 'notice':
            return <Notice key={key} text={s.subtitle ?? s.title} settings={s.settings as SectionSettings['notice']} />;
          case 'benefits':
            return <Benefits key={key} items={benefits} overlap={i > 0 && isGradientHero(i - 1)} />;
          case 'category_tiles': {
            const ids = (s.settings as SectionSettings['category_tiles']).category_ids;
            const chosen = ids.length ? ids.map((id) => categories.find((c) => c.id === id)).filter((c): c is (typeof categories)[number] => !!c) : categories;
            return <CategoryTiles key={key} title={s.title} subtitle={s.subtitle} categories={chosen} />;
          }
          case 'collection':
            return <Collection key={key} title={s.title} subtitle={s.subtitle} settings={s.settings as SectionSettings['collection']} products={lists[i]!} />;
          case 'product_row': {
            const st = s.settings as SectionSettings['product_row'];
            return <ProductRowSection key={key} title={s.title} subtitle={s.subtitle} settings={st} products={lists[i]!.slice(0, st.limit)} badge={st.source === 'new' ? 'New' : undefined} />;
          }
          case 'banners':
            return <Banners key={key} settings={s.settings as SectionSettings['banners']} />;
          case 'about':
            return <About key={key} title={s.title} text={s.subtitle} settings={s.settings as SectionSettings['about']} store={settings} />;
          default:
            return null;
        }
      })}

      {lists.every((l) => l.length === 0) && (
        <section className="container-page mt-16 text-center text-muted">
          <p>No products are published yet. Add some in the admin panel.</p>
        </section>
      )}
    </>
  );
}
