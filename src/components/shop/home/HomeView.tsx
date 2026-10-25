import type { IconName } from '../../icons';
import { About, Banners, Benefits, CategoryTiles, Collection, Gallery, HeroSection, Notice, ProductRowSection, QuickLinks, Testimonials } from './Sections';
import { NovaBanners, NovaBenefits, NovaCategories, NovaFavourites, NovaGallery, NovaGrid, NovaHero, NovaLook, NovaNewsletter, NovaReviews, NovaStory } from './NovaSections';
import { TopCircles, TopHero, TopProducts, TopSidebar } from './TopDealSections';
import { UrbanBanner, UrbanCategories, UrbanHero, UrbanProducts, UrbanTrust } from './UrbanSections';
import { MegaBanner, MegaDeals, MegaFrame, MegaGrid, MegaMobileCategories, MegaNotice, MegaSidebar } from './MegaSections';
import { MarketBanners, MarketCategoryGrid, MarketDeals, MarketHero, MarketProducts, MarketTiles, MarketTrio } from './MarketSections';
import { ChicBenefits, ChicCategories, ChicHero, ChicOffer, ChicProductRow } from './ChicSections';
import { BestSellers, Deal, NewsletterBand, ProductGridSection, ReviewCards, ThemeBanners, ThemeBenefits, ThemeCategories, ThemeHero, ThemeProductRow, type ShopTheme } from './ThemeSections';
import {
  getShopCategories, getCategoryCounts, getCategoryCovers, getCategoryProducts, getFeaturedProducts, getHomeSections, getNewArrivals, getOnSale, getProductsByIds, getSettings, getZones, maxDiscount,
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
  const [settings, categories, zones, rows, covers, latest, featured, counts] = await Promise.all([
    getSettings(), getShopCategories(), getZones(), getHomeSections(theme), getCategoryCovers(), getNewArrivals(9), getFeaturedProducts(6), getCategoryCounts(),
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
  const chic = theme === 'chic';
  const market = theme === 'market';
  const mega = theme === 'mega';
  const topdeal = theme === 'topdeal';
  const urban = theme === 'urban';
  const nova = theme === 'nova';
  // Mega: a banners section marked "sidebar" becomes the tall offer in the left column.
  const sideBanner = mega || topdeal ? sections.find((s) => s.type === 'banners' && lbl(s.settings, 'place', 'main') === 'sidebar') : undefined;
  const onSale = nova ? await getOnSale(12) : market && sections.some((s) => s.type === 'product_row' && (s.settings as SectionSettings['product_row']).layout === 'trio') ? await getOnSale(4) : [];
  const t = theme as ShopTheme;

  return (
    <>
      {!sections.some((s) => s.type === 'hero') && <h1 className="sr-only">{settings.store_name}</h1>}
      {(() => {
      const body = sections.map((s, i) => {
        const key = s.id;
        const products = lists[i]!;
        switch (s.type) {
          case 'hero':
            if (nova) return <NovaHero key={key} title={s.title} subtitle={s.subtitle} settings={s.settings as SectionSettings['hero']} store={settings} products={featured.length ? featured : latest} benefits={benefits} />;
            if (topdeal) return <TopHero key={key} title={s.title} subtitle={s.subtitle} settings={s.settings as SectionSettings['hero']} store={settings} products={featured.length ? featured : latest} categories={categories} covers={covers} />;
            if (urban) return <UrbanHero key={key} title={s.title} subtitle={s.subtitle} settings={s.settings as SectionSettings['hero']} store={settings} products={latest.length ? latest : featured} />;
            if (market || mega) return <MarketHero key={key} title={s.title} subtitle={s.subtitle} settings={s.settings as SectionSettings['hero']} store={settings} products={featured.length ? featured : latest} />;
            if (chic) return <ChicHero key={key} title={s.title} subtitle={s.subtitle} settings={s.settings as SectionSettings['hero']} store={settings} products={latest.length ? latest : featured} total={Object.values(counts).reduce((a, b) => a + b, 0)} />;
            return lux
              ? <HeroSection key={key} title={s.title} subtitle={s.subtitle} settings={s.settings as SectionSettings['hero']} store={settings} fallbackImage={photos[0] ?? null} />
              : <ThemeHero key={key} theme={t} title={s.title} subtitle={s.subtitle} settings={s.settings as SectionSettings['hero']} store={settings} discount={discount} products={featured.length ? featured : latest} />;
          case 'quick_links':
            return <QuickLinks key={key} settings={s.settings as SectionSettings['quick_links']} />;
          case 'notice':
            if (mega) return <MegaNotice key={key} title={s.title} text={s.subtitle} settings={s.settings as SectionSettings['notice']} />;
            return <Notice key={key} text={s.subtitle ?? s.title} settings={s.settings as SectionSettings['notice']} />;
          case 'benefits': {
            // Each card's wording can be renamed in the admin; blank keeps the automatic text.
            const items = benefits.map((b, n) => ({ ...b, title: lbl(s.settings, `b${n + 1}_title`, b.title), text: lbl(s.settings, `b${n + 1}_text`, b.text) }));
            if (nova) return <NovaBenefits key={key} items={items} />;
            if (chic || topdeal) return <ChicBenefits key={key} items={items} overlap={chic && sections[i - 1]?.type === 'hero'} />;
            if (urban) return <UrbanTrust key={key} title={s.title} items={items} />;
            return lux ? <Benefits key={key} items={items} /> : <ThemeBenefits key={key} theme={t} items={items} />;
          }
          case 'category_tiles': {
            const ids = (s.settings as SectionSettings['category_tiles']).category_ids;
            const chosen = ids.length ? ids.map((id) => categories.find((c) => c.id === id)).filter((c): c is (typeof categories)[number] => !!c) : categories;
            if (nova) return <NovaCategories key={key} title={s.title} settings={s.settings as SectionSettings['category_tiles']} categories={chosen} covers={covers} />;
            if (topdeal) return <TopCircles key={key} categories={chosen} covers={covers} />;
            if (urban) return <UrbanCategories key={key} title={s.title} categories={chosen} covers={covers} />;
            if (market) {
              return lbl(s.settings, 'style', 'grid') === 'mini'
                ? <MarketTiles key={key} categories={chosen} covers={covers} counts={counts} />
                : <MarketCategoryGrid key={key} title={s.title} categories={chosen} covers={covers} settings={s.settings as SectionSettings['category_tiles']} />;
            }
            if (chic) return <ChicCategories key={key} title={s.title} categories={chosen} covers={covers} counts={counts} settings={s.settings as SectionSettings['category_tiles']} />;
            return lux
              ? <CategoryTiles key={key} title={s.title} subtitle={s.subtitle} categories={chosen} images={covers} />
              : <ThemeCategories key={key} theme={t} title={s.title} categories={chosen} covers={covers} settings={s.settings as SectionSettings['category_tiles']} />;
          }
          case 'collection':
            if (nova) return <NovaLook key={key} title={s.title} subtitle={s.subtitle} settings={s.settings as SectionSettings['collection']} products={products} />;
            return lux || theme !== 'novatrend'
              ? <Collection key={key} title={s.title} subtitle={s.subtitle} settings={s.settings as SectionSettings['collection']} products={products} />
              : <BestSellers key={key} theme={t} title={s.title} settings={s.settings as SectionSettings['collection']} products={products} />;
          case 'product_row': {
            const st = s.settings as SectionSettings['product_row'];
            if (nova) return st.layout === 'grid' ? <NovaGrid key={key} title={s.title} settings={st} products={products.slice(0, st.limit)} /> : <NovaFavourites key={key} title={s.title} settings={st} products={products.slice(0, st.limit)} latest={latest} onSale={onSale} />;
            if (st.layout === 'grid' && !market && !mega && !topdeal && !urban) return <ProductGridSection key={key} theme={theme} title={s.title} subtitle={s.subtitle} link={st.link} button={lbl(st, 'grid_button', 'View all products')} products={products.slice(0, st.limit)} categories={categories} />;
            if (topdeal) return st.layout === 'grid' ? <MarketProducts key={key} title={s.title} settings={st} products={products.slice(0, st.limit)} /> : <TopProducts key={key} title={s.title} settings={st} products={products.slice(0, st.limit)} categories={categories} covers={covers} />;
            if (urban) return <UrbanProducts key={key} title={s.title} settings={st} products={products.slice(0, st.limit)} />;
            if (mega) return <MegaGrid key={key} title={s.title} settings={st} products={products.slice(0, st.limit)} categories={categories} />;
            if (market && st.layout === 'trio') {
              return <MarketTrio key={key} lists={[
                { title: 'New launches', href: '/products?sort=new', tone: 'bg-[#fff4dc]', products: latest },
                { title: 'Trending now', href: '/products', tone: 'bg-[#fde3ea]', products: featured },
                { title: 'On sale', href: '/products?sort=price-asc', tone: 'bg-[#dff1ec]', products: onSale },
              ]} />;
            }
            if (market) return <MarketProducts key={key} title={s.title} settings={st} products={products.slice(0, st.limit)} />;
            if (chic) return <ChicProductRow key={key} title={s.title} subtitle={s.subtitle} settings={st} products={products.slice(0, st.limit)} />;
            return lux
              ? <ProductRowSection key={key} title={s.title} subtitle={s.subtitle} settings={st} products={products.slice(0, st.limit)} />
              : <ThemeProductRow key={key} theme={t} title={s.title} subtitle={s.subtitle} settings={st} products={products.slice(0, st.limit)} />;
          }
          case 'banners':
            if (nova) return <NovaBanners key={key} title={s.title} settings={s.settings as SectionSettings['banners']} images={photos.slice(1)} />;
            if (topdeal) return s === sideBanner ? null : <MarketBanners key={key} eyebrow={s.title} settings={s.settings as SectionSettings['banners']} images={photos.slice(1)} />;
            if (urban) return <UrbanBanner key={key} settings={s.settings as SectionSettings['banners']} images={photos.slice(1)} />;
            if (mega) return s === sideBanner ? null : <MegaBanner key={key} eyebrow={s.title} settings={s.settings as SectionSettings['banners']} images={photos.slice(1)} />;
            if (market) return <MarketBanners key={key} eyebrow={s.title} settings={s.settings as SectionSettings['banners']} images={photos.slice(1)} />;
            if (chic) return <ChicOffer key={key} eyebrow={s.title} settings={s.settings as SectionSettings['banners']} images={photos.slice(1)} />;
            return lux
              ? <Banners key={key} eyebrow={s.title} settings={s.settings as SectionSettings['banners']} fallbackImage={photos[1] ?? photos[0] ?? null} />
              : <ThemeBanners key={key} theme={t} eyebrow={s.title} settings={s.settings as SectionSettings['banners']} images={photos.slice(1)} />;
          case 'testimonials':
            if (nova) return <NovaReviews key={key} title={s.title} settings={s.settings as SectionSettings['testimonials']} />;
            return lux
              ? <Testimonials key={key} title={s.title} settings={s.settings as SectionSettings['testimonials']} products={products} />
              : <ReviewCards key={key} theme={t} title={s.title} settings={s.settings as SectionSettings['testimonials']} />;
          case 'gallery':
            if (nova) return <NovaGallery key={key} title={s.title} settings={s.settings as SectionSettings['gallery']} fallback={latest.filter((p) => p.images[0]).map((p) => ({ image: p.images[0]!.storage_path, link: `/product/${p.slug}` }))} />;
            return <Gallery key={key} title={s.title} settings={s.settings as SectionSettings['gallery']} fallback={latest.filter((p) => p.images[0]).map((p) => ({ image: p.images[0]!.storage_path, link: `/product/${p.slug}` }))} />;
          case 'about':
            if (nova) return <NovaStory key={key} title={s.title} text={s.subtitle} settings={s.settings as SectionSettings['about']} image={photos[3] ?? photos[0] ?? null} />;
            return <About key={key} title={s.title} text={s.subtitle} settings={s.settings as SectionSettings['about']} store={settings} />;
          case 'deal':
            if (topdeal) return <MarketDeals key={key} title={s.title} settings={s.settings as SectionSettings['deal']} products={products.slice(0, (s.settings as SectionSettings['deal']).limit)} />;
            if (mega) return <MegaDeals key={key} title={s.title} settings={s.settings as SectionSettings['deal']} products={products.slice(0, (s.settings as SectionSettings['deal']).limit)} />;
            if (market) return <MarketDeals key={key} title={s.title} settings={s.settings as SectionSettings['deal']} products={products.slice(0, (s.settings as SectionSettings['deal']).limit)} />;
            return <Deal key={key} theme={theme} title={s.title} subtitle={s.subtitle} settings={s.settings as SectionSettings['deal']} product={products[0] ?? null} />;
          case 'newsletter':
            if (nova) return <NovaNewsletter key={key} title={s.title} subtitle={s.subtitle} settings={s.settings as SectionSettings['newsletter']} store={settings} />;
            return <NewsletterBand key={key} theme={theme} title={s.title} subtitle={s.subtitle} settings={s.settings as SectionSettings['newsletter']} />;
          default:
            return null;
        }
      });
      if (topdeal) {
        const split = sections.findIndex((s) => !['hero', 'benefits', 'category_tiles'].includes(s.type));
        if (split < 0) return body;
        const offer = (sideBanner?.settings as SectionSettings['banners'] | undefined)?.items.find((b) => b.image || b.title);
        return (
          <>
            {body.slice(0, split)}
            <div className="mt-8">
              <MegaFrame
                top={null}
                sidebar={<TopSidebar featured={featured} latest={latest} offer={offer ? { image: offer.image ?? photos[2] ?? null, title: offer.title, subtitle: offer.subtitle, link: offer.link || '/products' } : null} />}
              >
                {body.slice(split)}
              </MegaFrame>
            </div>
          </>
        );
      }
      if (!mega) return body;
      const offer = (sideBanner?.settings as SectionSettings['banners'] | undefined)?.items.find((b) => b.image || b.title);
      return (
        <MegaFrame
          top={<MegaMobileCategories categories={categories} covers={covers} />}
          sidebar={
            <MegaSidebar
              categories={categories}
              covers={covers}
              latest={latest}
              benefits={benefits}
              offer={offer ? { image: offer.image ?? photos[2] ?? null, title: offer.title, subtitle: offer.subtitle, link: offer.link || '/products' } : null}
            />
          }
        >
          {body}
        </MegaFrame>
      );
      })()}
      {lists.every((l) => l.length === 0) && latest.length === 0 && (
        <section className="container-page mt-16 text-center text-muted"><p>No products are published yet. Add some in the admin panel.</p></section>
      )}
    </>
  );
}
