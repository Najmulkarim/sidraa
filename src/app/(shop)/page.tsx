import type { IconName } from '@/components/icons';
import { About, Banners, Benefits, CategoryTiles, Collection, Gallery, HeroSection, Notice, ProductRowSection, QuickLinks, Testimonials } from '@/components/shop/home/Sections';
import {
  getCategories, getCategoryCovers, getCategoryProducts, getFeaturedProducts, getHomeSections, getNewArrivals, getOnSale, getProductsByIds, getSettings, getZones,
  type HomeSectionRow,
} from '@/lib/catalog';
import { SITE_URL } from '@/lib/env';
import { formatTaka } from '@/lib/format';
import { parseSettings, SECTION_TYPES, type SectionSettings, type SectionType } from '@/lib/home-sections';
import type { ProductWithRelations } from '@/lib/types';

// Statically cached; admin saves call revalidatePath('/', 'layout').
export const revalidate = 300;

/** Used until the home_sections table exists or if it cannot be read: the luxury layout. */
const FALLBACK: HomeSectionRow[] = [
  { id: 'hero', type: 'hero', title: 'Elevate your everyday style', subtitle: 'Premium fashion, cash on delivery all over Bangladesh.', enabled: true, sort_order: 10, settings: {} },
  { id: 'benefits', type: 'benefits', title: null, subtitle: null, enabled: true, sort_order: 20, settings: {} },
  { id: 'cats', type: 'category_tiles', title: 'Find your signature look', subtitle: 'Curated collections for every mood.', enabled: true, sort_order: 30, settings: {} },
  { id: 'loved', type: 'product_row', title: 'Most loved this week', subtitle: 'Handpicked favourites from our customers.', enabled: true, sort_order: 40, settings: { source: 'featured', limit: 12 } },
  { id: 'fav', type: 'testimonials', title: 'What our customers say', subtitle: null, enabled: true, sort_order: 60, settings: { source: 'new', limit: 4, products_title: 'Customer favourites' } },
  { id: 'gallery', type: 'gallery', title: 'Follow our style', subtitle: null, enabled: true, sort_order: 70, settings: {} },
];

type ProductList = Pick<SectionSettings['collection'], 'source' | 'category_id' | 'product_ids' | 'limit'>;

/** The products a section asks for (one extra, for layouts that want a spare). */
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

const HAS_PRODUCTS: SectionType[] = ['collection', 'product_row', 'testimonials'];

export default async function HomePage() {
  const [settings, categories, zones, rows, covers, latest] = await Promise.all([
    getSettings(), getCategories(), getZones(), getHomeSections(), getCategoryCovers(), getNewArrivals(9),
  ]);

  const sections = (rows ?? FALLBACK)
    .filter((r): r is HomeSectionRow & { type: SectionType } => (SECTION_TYPES as readonly string[]).includes(r.type))
    .map((r) => ({ ...r, settings: parseSettings(r.type, r.settings) }));

  // Fetch every section's products at once.
  const lists = await Promise.all(sections.map((s) => (HAS_PRODUCTS.includes(s.type) ? productsFor(s.settings as ProductList) : Promise.resolve([]))));
  const photos = [...lists.flat(), ...latest].map((p) => p.images[0]?.storage_path).filter((x): x is string => !!x);

  const freeOver = zones.map((z) => (z.free_over === null ? null : Number(z.free_over))).filter((n): n is number => n !== null);
  const fastest = zones[0]?.eta_text;
  // Benefit strip: every line here is something the shop actually does.
  const benefits: { icon: IconName; title: string; text: string; href: string }[] = [
    { icon: 'truck', title: freeOver.length ? 'Free delivery' : 'Nationwide delivery', text: freeOver.length ? `On orders over ${formatTaka(Math.min(...freeOver))}` : fastest ? `Inside Dhaka in ${fastest}` : 'All over Bangladesh', href: '/info/delivery' },
    { icon: 'return', title: `Easy ${settings.return_policy_days}-day returns`, text: 'Hassle-free exchange', href: '/info/returns' },
    { icon: 'cash', title: 'Cash on delivery', text: 'Pay when it reaches you', href: '/info/delivery' },
    { icon: 'eye', title: 'Check before paying', text: 'Open the parcel with the rider', href: '/info/delivery' },
    { icon: settings.phone ? 'phone' : 'shield', title: settings.phone ? 'Here to help' : 'Secure order', text: settings.phone ?? 'No account needed', href: settings.phone ? `tel:${settings.phone.replace(/[^\d+]/g, '')}` : '/track' },
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
  const hasHero = sections.some((s) => s.type === 'hero');

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      {!hasHero && <h1 className="sr-only">{settings.store_name}</h1>}

      {sections.map((s, i) => {
        const key = s.id;
        switch (s.type) {
          case 'hero':
            return <HeroSection key={key} title={s.title} subtitle={s.subtitle} settings={s.settings as SectionSettings['hero']} store={settings} fallbackImage={photos[0] ?? null} />;
          case 'quick_links':
            return <QuickLinks key={key} settings={s.settings as SectionSettings['quick_links']} />;
          case 'notice':
            return <Notice key={key} text={s.subtitle ?? s.title} settings={s.settings as SectionSettings['notice']} />;
          case 'benefits':
            return <Benefits key={key} items={benefits} />;
          case 'category_tiles': {
            const ids = (s.settings as SectionSettings['category_tiles']).category_ids;
            const chosen = ids.length ? ids.map((id) => categories.find((c) => c.id === id)).filter((c): c is (typeof categories)[number] => !!c) : categories;
            return <CategoryTiles key={key} title={s.title} subtitle={s.subtitle} categories={chosen} images={covers} />;
          }
          case 'collection':
            return <Collection key={key} title={s.title} subtitle={s.subtitle} settings={s.settings as SectionSettings['collection']} products={lists[i]!} />;
          case 'product_row': {
            const st = s.settings as SectionSettings['product_row'];
            return <ProductRowSection key={key} title={s.title} subtitle={s.subtitle} settings={st} products={lists[i]!.slice(0, st.limit)} />;
          }
          case 'banners':
            return <Banners key={key} eyebrow={s.title} settings={s.settings as SectionSettings['banners']} fallbackImage={photos[1] ?? photos[0] ?? null} />;
          case 'testimonials':
            return <Testimonials key={key} title={s.title} settings={s.settings as SectionSettings['testimonials']} products={lists[i]!} />;
          case 'gallery':
            return <Gallery key={key} title={s.title} settings={s.settings as SectionSettings['gallery']} fallback={latest.filter((p) => p.images[0]).map((p) => ({ image: p.images[0]!.storage_path, link: `/product/${p.slug}` }))} />;
          case 'about':
            return <About key={key} title={s.title} text={s.subtitle} settings={s.settings as SectionSettings['about']} store={settings} />;
          default:
            return null;
        }
      })}

      {lists.every((l) => l.length === 0) && latest.length === 0 && (
        <section className="container-page mt-16 text-center text-muted">
          <p>No products are published yet. Add some in the admin panel.</p>
        </section>
      )}
    </>
  );
}
