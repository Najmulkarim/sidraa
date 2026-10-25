import type { IconName } from '../../icons';
import { About, Banners, Benefits, CategoryTiles, Collection, Gallery, HeroSection, Notice, ProductRowSection, QuickLinks, Testimonials } from './Sections';
import { BestSellers, Deal, NewsletterBand, ProductGridSection, ReviewCards, ThemeBanners, ThemeBenefits, ThemeCategories, ThemeHero, ThemeProductRow, type ShopTheme } from './ThemeSections';
import {
  getShopCategories, getCategoryCovers, getCategoryProducts, getFeaturedProducts, getHomeSections, getNewArrivals, getOnSale, getProductsByIds, getSettings, getZones, maxDiscount,
  type HomeSectionRow,
} from '@/lib/catalog';
import { formatTaka } from '@/lib/format';
import { lbl, parseSettings, SECTION_TYPES, type SectionSettings, type SectionType, type ThemeKey } from '@/lib/home-sections';
import type { ProductWithRelations } from '@/lib/types';

/** Used when a theme's sections cannot be read: a short version of the Luxora layout. */
const FALLBACK: HomeSectionRow[] = [
  { id: 'hero', type: 'hero', title: 'Elevate your everyday style', subtitle: 'Premium fashion, cash on delivery all over Bangladesh.', enabled: true, sort_order: 10, settings: {} },
  { id: 'benefits', type: 'benefits', title: null, subtitle: null, enabled: true, sort_order: 20, settings: {} },
  { id: 'cats', type: 'category_tiles', title: 'Find your signature look', subtitle: 'Curated collections for every mood.', enabled: true, sort_order: 30, settings: {} },
  { id: 'loved', type: 'product_row', title: 'Most loved this week', subtitle: null, enabled: true, sort_order: 40, settings: { source: 'featured', limit: 12 } },
];

type ProductList = Pick<SectionSettings['collection'], 'source' | 'category_id' | 'product_ids' | 'limit'>;

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

const HAS_PRODUCTS: SectionType[] = ['collection', 'product_row', 'testimonials', 'deal'];

/** The whole home page for one theme (the live page and the admin preview). */
export async function HomeView({ theme }: { theme: ThemeKey }) {
  const [settings, categories, zones, rows, covers, latest, featured] = await Promise.all([
    getSettings(), getShopCategories(), getZones(), getHomeSections(theme), getCategoryCovers(), getNewArrivals(9), getFeaturedProducts(6),
  ]);

  const sections = (rows ?? FALLBACK)
    .filter((r): r is HomeSectionRow & { type: SectionType } => (SECTION_TYPES as readonly string[]).includes(r.type))
    .map((r) => ({ ...r, settings: parseSettings(r.type, r.settings) }));
  const lists = await Promise.all(sections.map((s) => (HAS_PRODUCTS.includes(s.type) ? productsFor(s.settings as ProductList) : Promise.resolve([]))));
  const photos = [...featured, ...lists.flat(), ...latest].map((p) => p.images[0]?.storage_path).filter((x): x is string => !!x);
  const discount = maxDiscount([...lists.flat(), ...featured]);

  const freeOver = zones.map((z) => (z.free_over === null ? null : Number(z.free_over))).filter((n): n is number => n !== null);
  const fastest = zones[0]?.eta_text;
  // Benefit strip: every line here is something the shop actually does.
  const benefits: { icon: IconName; title: string; text: string; href: string }[] = [
    { icon: 'truck', title: freeOver.length ? 'Free delivery' : 'Nationwide delivery', text: freeOver.length ? `On orders over ${formatTaka(Math.min(...freeOver))}` : fastest ? `Inside Dhaka in ${fastest}` : 'All over Bangladesh', href: '/info/delivery' },
    { icon: 'return', title: `Easy ${settings.return_policy_days}-day returns`, text: 'Hassle-free exchange', href: '/info/returns' },
    { icon: 'cash', title: 'Cash on delivery', text: 'Pay when it reaches you', href: '/info/delivery' },
    { icon: settings.phone ? 'phone' : 'eye', title: settings.phone ? 'Here to help' : 'Check before paying', text: settings.phone ?? 'Open the parcel with the rider', href: settings.phone ? `tel:${settings.phone.replace(/[^\d+]/g, '')}` : '/info/delivery' },
    { icon: 'shield', title: 'Secure order', text: 'No account needed', href: '/track' },
  ];

  const lux = theme === 'luxora';
  const t = theme as ShopTheme;

  return (
    <>
      {!sections.some((s) => s.type === 'hero') && <h1 className="sr-only">{settings.store_name}</h1>}
      {sections.map((s, i) => {
        const key = s.id;
        const products = lists[i]!;
        switch (s.type) {
          case 'hero':
            return lux
              ? <HeroSection key={key} title={s.title} subtitle={s.subtitle} settings={s.settings as SectionSettings['hero']} store={settings} fallbackImage={photos[0] ?? null} />
              : <ThemeHero key={key} theme={t} title={s.title} subtitle={s.subtitle} settings={s.settings as SectionSettings['hero']} store={settings} discount={discount} products={featured.length ? featured : latest} />;
          case 'quick_links':
            return <QuickLinks key={key} settings={s.settings as SectionSettings['quick_links']} />;
          case 'notice':
            return <Notice key={key} text={s.subtitle ?? s.title} settings={s.settings as SectionSettings['notice']} />;
          case 'benefits': {
            // Each card's wording can be renamed in the admin; blank keeps the automatic text.
            const items = benefits.map((b, n) => ({ ...b, title: lbl(s.settings, `b${n + 1}_title`, b.title), text: lbl(s.settings, `b${n + 1}_text`, b.text) }));
            return lux ? <Benefits key={key} items={items} /> : <ThemeBenefits key={key} theme={t} items={items} />;
          }
          case 'category_tiles': {
            const ids = (s.settings as SectionSettings['category_tiles']).category_ids;
            const chosen = ids.length ? ids.map((id) => categories.find((c) => c.id === id)).filter((c): c is (typeof categories)[number] => !!c) : categories;
            return lux
              ? <CategoryTiles key={key} title={s.title} subtitle={s.subtitle} categories={chosen} images={covers} />
              : <ThemeCategories key={key} theme={t} title={s.title} categories={chosen} covers={covers} settings={s.settings as SectionSettings['category_tiles']} />;
          }
          case 'collection':
            return lux || theme !== 'novatrend'
              ? <Collection key={key} title={s.title} subtitle={s.subtitle} settings={s.settings as SectionSettings['collection']} products={products} />
              : <BestSellers key={key} theme={t} title={s.title} settings={s.settings as SectionSettings['collection']} products={products} />;
          case 'product_row': {
            const st = s.settings as SectionSettings['product_row'];
            if (st.layout === 'grid') return <ProductGridSection key={key} theme={theme} title={s.title} subtitle={s.subtitle} link={st.link} button={lbl(st, 'grid_button', 'View all products')} products={products.slice(0, st.limit)} categories={categories} />;
            return lux
              ? <ProductRowSection key={key} title={s.title} subtitle={s.subtitle} settings={st} products={products.slice(0, st.limit)} />
              : <ThemeProductRow key={key} theme={t} title={s.title} subtitle={s.subtitle} settings={st} products={products.slice(0, st.limit)} />;
          }
          case 'banners':
            return lux
              ? <Banners key={key} eyebrow={s.title} settings={s.settings as SectionSettings['banners']} fallbackImage={photos[1] ?? photos[0] ?? null} />
              : <ThemeBanners key={key} theme={t} eyebrow={s.title} settings={s.settings as SectionSettings['banners']} images={photos.slice(1)} />;
          case 'testimonials':
            return lux
              ? <Testimonials key={key} title={s.title} settings={s.settings as SectionSettings['testimonials']} products={products} />
              : <ReviewCards key={key} theme={t} title={s.title} settings={s.settings as SectionSettings['testimonials']} />;
          case 'gallery':
            return <Gallery key={key} title={s.title} settings={s.settings as SectionSettings['gallery']} fallback={latest.filter((p) => p.images[0]).map((p) => ({ image: p.images[0]!.storage_path, link: `/product/${p.slug}` }))} />;
          case 'about':
            return <About key={key} title={s.title} text={s.subtitle} settings={s.settings as SectionSettings['about']} store={settings} />;
          case 'deal':
            return <Deal key={key} theme={theme} title={s.title} subtitle={s.subtitle} settings={s.settings as SectionSettings['deal']} product={products[0] ?? null} />;
          case 'newsletter':
            return <NewsletterBand key={key} theme={theme} title={s.title} subtitle={s.subtitle} settings={s.settings as SectionSettings['newsletter']} />;
          default:
            return null;
        }
      })}
      {lists.every((l) => l.length === 0) && latest.length === 0 && (
        <section className="container-page mt-16 text-center text-muted"><p>No products are published yet. Add some in the admin panel.</p></section>
      )}
    </>
  );
}
