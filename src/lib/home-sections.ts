import { z } from 'zod';

/**
 * Home page builder: section types, their settings and validation. Shared by
 * the shop (rendering), the admin editor and the server actions. Settings
 * are stored as JSON in public.home_sections.settings.
 */

export const SECTION_TYPES = ['hero', 'quick_links', 'notice', 'benefits', 'category_tiles', 'collection', 'product_row', 'banners', 'about', 'testimonials', 'gallery', 'deal', 'newsletter'] as const;

/** Home page themes: each has its own sections; store_settings.home_theme picks the live one. */
export const THEMES = ['luxora', 'shopease', 'luxe', 'novatrend', 'chic', 'market', 'mega'] as const;
export type ThemeKey = (typeof THEMES)[number];
export const THEME_INFO: Record<ThemeKey, { name: string; tagline: string; swatches: string[] }> = {
  luxora: { name: 'Luxora', tagline: 'Soft blush, elegant serif, editorial and calm.', swatches: ['var(--cream)', 'var(--night)', 'var(--brand)'] },
  shopease: { name: 'ShopEase', tagline: 'Bold deals store: dark hero card, deal of the day, newsletter band.', swatches: ['var(--night)', 'var(--brand)', '#fff4f7'] },
  luxe: { name: 'Luxe Fashion', tagline: 'Bright boutique: photo hero, category circles, promo cards, reviews.', swatches: ['#fff', 'var(--brand)', 'var(--cream)'] },
  novatrend: { name: 'NovaTrend', tagline: 'Modern and punchy: floating product cards, best sellers, flash sale.', swatches: ['#fff', 'var(--night)', 'var(--brand)'] },
  mega: { name: 'Mega', tagline: 'Department store: dark header, category sidebar, daily deals, trending grid.', swatches: ['var(--night)', 'var(--brand)', '#f3eef0'] },
  market: { name: 'Market', tagline: 'Big-store layout: search bar, flash deals, category grid, many product rows.', swatches: ['#fff', 'var(--brand)', '#fde3c4'] },
  chic: { name: 'Chic', tagline: 'Soft and feminine: photo on a colour circle, pastel category cards, offer band.', swatches: ['var(--cream)', 'var(--brand)', '#fff'] },
};
export function isTheme(v: unknown): v is ThemeKey {
  return typeof v === 'string' && (THEMES as readonly string[]).includes(v);
}
export type SectionType = (typeof SECTION_TYPES)[number];

export const SECTION_INFO: Record<SectionType, { label: string; hint: string }> = {
  hero: { label: 'Hero banner / slider', hint: 'Big banner at the top. Add photos to make it a slider; without photos it shows the brand gradient with your heading.' },
  quick_links: { label: 'Quick links bar', hint: 'A row of short links under the banner, e.g. Shop all, Men, Women, Sale.' },
  notice: { label: 'Notice strip', hint: 'One highlighted line of text with an optional link, e.g. an offer or delivery news.' },
  benefits: { label: 'Benefit cards', hint: 'Cash on delivery, free delivery, check before paying, returns — from your settings.' },
  category_tiles: { label: 'Category tiles', hint: 'Picture tiles for your categories. Pick which ones and their order, or leave empty for all.' },
  collection: { label: 'Collection (feature photo + products)', hint: 'A large feature photo with a grid of products and a "View more" tile.' },
  product_row: { label: 'Product slider / grid', hint: 'A row of products that scrolls sideways, or a grid (e.g. All products) with a View all button.' },
  banners: { label: 'Promo banners', hint: 'One to three banner pictures side by side, each with its own link.' },
  about: { label: 'About / brand story', hint: 'A short story about the shop with a photo.' },
  testimonials: { label: 'Customer favourites + reviews', hint: 'A few products on the left and real customer comments on the right (a slider). Only add comments customers actually sent you.' },
  deal: { label: 'Deal of the day (countdown)', hint: 'One product with its price and a countdown to the end time you set. Without an end time no timer is shown.' },
  newsletter: { label: 'Newsletter band', hint: 'A wide strip asking visitors for their email (saved in your subscriber list).' },
  gallery: { label: 'Photo gallery (Follow our style)', hint: 'A strip of photos, e.g. from your Facebook or Instagram. Without photos it shows your newest product photos.' },
};

export const PRODUCT_SOURCES = ['manual', 'featured', 'new', 'sale', 'category'] as const;
export type ProductSource = (typeof PRODUCT_SOURCES)[number];
export const SOURCE_LABEL: Record<ProductSource, string> = {
  manual: 'Products I choose (in my order)',
  featured: 'Featured products',
  new: 'Newest products',
  sale: 'Products on sale',
  category: 'Products from a category',
};

// Links: a site path ("/products?sort=new") or a full https:// address. Never javascript: or data:.
const link = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === '' || /^\/(?!\/)[^\s]*$/.test(v) || /^https:\/\/[^\s]+$/.test(v), 'Use a site path like /products or a full https:// link')
  .default('');
// Images: an uploaded file in the bucket (home/…, products/…) or a site file (/demo/…).
const image = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === '' || /^\/[\w\-./]+$/.test(v) || /^(home|products|branding)\/[\w\-./]+$/.test(v), 'Invalid image')
  .nullable()
  .default(null)
  .transform((v) => v || null);
const text = (max: number) => z.string().trim().max(max).default('');
const uuidList = z.array(z.uuid()).max(48).default([]);
// Small texts a section shows (buttons, badges, captions). Blank keeps the default.
const labels = z.record(z.string().regex(/^[a-z0-9_]{1,30}$/), z.string().trim().max(60)).default({});

const productList = z.object({
  source: z.enum(PRODUCT_SOURCES).default('featured'),
  category_id: z.uuid().nullable().default(null),
  product_ids: uuidList,
  limit: z.coerce.number().int().min(1).max(24).default(8),
});

export const SETTINGS_SCHEMA = {
  hero: z.object({
    slides: z.array(z.object({ image, title: text(120), subtitle: text(200), button: text(30), link })).max(8).default([]),
    button: text(30),
    link,
    labels,
  }),
  quick_links: z.object({ links: z.array(z.object({ label: text(40), href: link })).max(10).default([]) }),
  notice: z.object({ link_label: text(40), link }),
  benefits: z.object({ labels }),
  category_tiles: z.object({ category_ids: uuidList, labels }),
  collection: productList.extend({ image, link, labels }),
  // layout 'grid': a plain grid (e.g. "All products", 20 items) with a View all button under it.
  product_row: productList.extend({ link, autoplay: z.boolean().default(true), layout: z.enum(['row', 'grid', 'trio']).default('row'), labels }),
  banners: z.object({ items: z.array(z.object({ image, title: text(80), subtitle: text(160), link })).max(3).default([]), labels }),
  about: z.object({ image, link, link_label: text(40) }),
  testimonials: productList.extend({
    products_title: text(80),
    items: z.array(z.object({ quote: text(400), name: text(60), place: text(60), rating: z.coerce.number().int().min(1).max(5).default(5) })).max(12).default([]),
  }),
  gallery: z.object({ images: z.array(z.object({ image, link })).max(12).default([]), handle: text(60), handle_link: link }),
  deal: productList.extend({
    eyebrow: text(40),
    link,
    // When the deal ends (ISO date-time). Empty: no countdown.
    ends_at: z.string().trim().max(40).nullable().default(null).transform((v) => (v && !Number.isNaN(Date.parse(v)) ? v : null)),
    labels,
  }),
  newsletter: z.object({ labels }),
} satisfies Record<SectionType, z.ZodType>;

/** The texts each section lets the admin rename; "fallback" is what shows when left blank. */
export const LABEL_FIELDS: Partial<Record<SectionType, { key: string; name: string; fallback: string }[]>> = {
  hero: [
    { key: 'eyebrow', name: 'Small text above the heading', fallback: 'Your shop tagline' },
    { key: 'button2', name: 'Second button', fallback: 'Explore collection / New arrivals' },
    { key: 'chip1', name: 'ShopEase point 1', fallback: 'Best prices' },
    { key: 'chip1_text', name: 'ShopEase point 1 – small text', fallback: 'Every day' },
    { key: 'chip2', name: 'ShopEase point 2', fallback: 'Cash on delivery' },
    { key: 'chip2_text', name: 'ShopEase point 2 – small text', fallback: 'Pay at your door' },
    { key: 'chip3', name: 'ShopEase point 3', fallback: 'Fast delivery' },
    { key: 'chip3_text', name: 'ShopEase point 3 – small text', fallback: 'All over Bangladesh' },
  ],
  benefits: [1, 2, 3, 4, 5].flatMap((i) => [
    { key: `b${i}_title`, name: `Card ${i} – title`, fallback: 'Automatic (from Settings)' },
    { key: `b${i}_text`, name: `Card ${i} – small text`, fallback: 'Automatic (from Settings)' },
  ]),
  category_tiles: [
    { key: 'view_all', name: '“View all” link', fallback: 'View all categories' },
    { key: 'tile', name: 'Text under each category', fallback: 'Shop now' },
    { key: 'style', name: 'Market theme: “mini” for small tiles, empty for the grid', fallback: 'grid' },
  ],
  collection: [
    { key: 'view_all', name: '“View all” link', fallback: 'View all' },
    { key: 'badge', name: 'Badge on each product (NovaTrend)', fallback: 'Bestseller' },
    { key: 'eyebrow', name: 'Small text on the photo (Luxora)', fallback: 'Collection' },
    { key: 'button', name: 'Button on the photo (Luxora)', fallback: 'Shop now' },
  ],
  product_row: [
    { key: 'view_all', name: '“View all” link (slider)', fallback: 'View all' },
    { key: 'grid_button', name: 'Button under the grid', fallback: 'View all products' },
    { key: 'badge', name: 'Badge on each product', fallback: 'New / Hot' },
  ],
  banners: [
    { key: 'button', name: 'Button / link text', fallback: 'Shop now' },
    { key: 'place', name: 'Mega theme: “sidebar” shows the first banner in the left column', fallback: 'main' },
  ],
  deal: [{ key: 'button', name: 'Button text', fallback: 'Shop the deal' }],
  newsletter: [
    { key: 'button', name: 'Button text', fallback: 'Subscribe' },
    { key: 'placeholder', name: 'Text inside the email box', fallback: 'Enter your email' },
  ],
};

/** A section's own wording for `key`, or the default. */
export function lbl(settings: unknown, key: string, fallback: string): string {
  const v = (settings as { labels?: Record<string, string> } | null | undefined)?.labels?.[key];
  return v && v.trim() ? v.trim() : fallback;
}

export type SectionSettings = { [K in SectionType]: z.infer<(typeof SETTINGS_SCHEMA)[K]> };

export type HomeSection<T extends SectionType = SectionType> = {
  id: string;
  type: T;
  title: string | null;
  subtitle: string | null;
  enabled: boolean;
  sort_order: number;
  settings: SectionSettings[T];
};

/** Parses stored settings; anything malformed falls back to the type's defaults. */
export function parseSettings<T extends SectionType>(type: T, raw: unknown): SectionSettings[T] {
  const r = SETTINGS_SCHEMA[type].safeParse(raw ?? {});
  return (r.success ? r.data : SETTINGS_SCHEMA[type].parse({})) as SectionSettings[T];
}

export const sectionInputSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().max(120).transform((v) => v || null),
  subtitle: z.string().trim().max(600).transform((v) => v || null),
  enabled: z.boolean(),
});
