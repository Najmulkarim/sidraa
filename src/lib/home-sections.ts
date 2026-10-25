import { z } from 'zod';

/**
 * Home page builder: section types, their settings and validation. Shared by
 * the shop (rendering), the admin editor and the server actions. Settings
 * are stored as JSON in public.home_sections.settings.
 */

export const SECTION_TYPES = ['hero', 'quick_links', 'notice', 'benefits', 'category_tiles', 'collection', 'product_row', 'banners', 'about'] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

export const SECTION_INFO: Record<SectionType, { label: string; hint: string }> = {
  hero: { label: 'Hero banner / slider', hint: 'Big banner at the top. Add photos to make it a slider; without photos it shows the brand gradient with your heading.' },
  quick_links: { label: 'Quick links bar', hint: 'A row of short links under the banner, e.g. Shop all, Men, Women, Sale.' },
  notice: { label: 'Notice strip', hint: 'One highlighted line of text with an optional link, e.g. an offer or delivery news.' },
  benefits: { label: 'Benefit cards', hint: 'Cash on delivery, free delivery, check before paying, returns — from your settings.' },
  category_tiles: { label: 'Category tiles', hint: 'Picture tiles for your categories. Pick which ones and their order, or leave empty for all.' },
  collection: { label: 'Collection (feature photo + products)', hint: 'A large feature photo with a grid of products and a "View more" tile.' },
  product_row: { label: 'Product slider', hint: 'A row of products that scrolls sideways.' },
  banners: { label: 'Promo banners', hint: 'One to three banner pictures side by side, each with its own link.' },
  about: { label: 'About / brand story', hint: 'A short story about the shop with a photo.' },
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
  }),
  quick_links: z.object({ links: z.array(z.object({ label: text(40), href: link })).max(10).default([]) }),
  notice: z.object({ link_label: text(40), link }),
  benefits: z.object({}),
  category_tiles: z.object({ category_ids: uuidList }),
  collection: productList.extend({ image, link }),
  product_row: productList.extend({ link }),
  banners: z.object({ items: z.array(z.object({ image, title: text(80), subtitle: text(160), link })).max(3).default([]) }),
  about: z.object({ image, link, link_label: text(40) }),
} satisfies Record<SectionType, z.ZodType>;

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
