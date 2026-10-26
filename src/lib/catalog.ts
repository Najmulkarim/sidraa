/**
 * Public catalogue queries. All go through the cookieless client, so RLS
 * returns only published products, active variants and public categories.
 * React cache() de-duplicates calls within one render.
 *
 * Settings, categories and zones are read on every shop page (the layout)
 * but change rarely, so they also sit in the Next.js data cache under the
 * CATALOG_TAG tag. Admin actions that change them call updateTag(CATALOG_TAG).
 */
import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { createPublicClient } from '@/lib/supabase/public';
import { toNumber } from '@/lib/format';
import { sizeRank } from './sizes';
import type { Category, DeliveryZone, ProductWithRelations, StoreSettings, Variant } from '@/lib/types';

export const PRODUCT_SELECT =
  'id, sku, category_id, name, slug, description, base_price, compare_at_price, discount_style, stock_out_mode, preorder_days, status, is_featured, seo_title, seo_description, color_label, size_label, option3_label, published_at, created_at, updated_at, rating_avg, rating_count,' +
  ' category:categories(id, name, slug), images:product_images(id, storage_path, alt, sort_order),' +
  ' variants:product_variants(id, product_id, sku, size, color, option3, image_path, price, stock, is_active)';

export const PAGE_SIZE = 24;

const FALLBACK_SETTINGS: StoreSettings = {
  store_name: 'Your Store',
  tagline: null,
  logo_path: null,
  theme: {},
  phone: null,
  email: null,
  address: null,
  social: {},
  cod_terms: 'Pay the rider in cash when your parcel arrives.',
  return_policy_days: 3,
  order_ref_prefix: 'SD',
  low_stock_threshold: 3,
  fb_pixel_id: null,
  announcement: null,
  coupons_enabled: true,
  home_theme: 'luxora',
  storefront: {},
  order_number_prefix: 'Order',
};

function sortRelations(p: ProductWithRelations): ProductWithRelations {
  return {
    ...p,
    images: [...(p.images ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    variants: [...(p.variants ?? [])].sort((a, b) => sizeRank(a.size) - sizeRank(b.size) || a.sku.localeCompare(b.sku)),
  };
}

export { sizeRank } from './sizes';

export const CATALOG_TAG = 'catalog';

/** Thrown inside the data cache so a failed read is never stored; the caller falls back. */
class CatalogReadError extends Error {}

/** Data-cache wrapper for the layout reads: 5 minutes, or until updateTag(CATALOG_TAG). */
function cachedRead<T>(key: string, read: () => Promise<T>, fallback: T): () => Promise<T> {
  const cached = unstable_cache(read, ['catalog', key], { tags: [CATALOG_TAG], revalidate: 300 });
  return cache(async () => {
    try {
      return await cached();
    } catch (e) {
      console.error(`[catalog] ${key}`, e instanceof Error ? e.message : e);
      return fallback;
    }
  });
}

export const getSettings = cachedRead('settings', async (): Promise<StoreSettings> => {
  const { data, error } = await createPublicClient()
    .from('store_settings')
    .select('store_name, tagline, logo_path, theme, phone, email, address, social, cod_terms, return_policy_days, order_ref_prefix, low_stock_threshold, fb_pixel_id, announcement, coupons_enabled, home_theme, storefront, order_number_prefix')
    .eq('id', 1)
    .maybeSingle();
  if (error || !data) throw new CatalogReadError(error?.message ?? 'store_settings row missing');
  return data as StoreSettings;
}, FALLBACK_SETTINGS);

export const getCategories = cachedRead('categories', async (): Promise<Category[]> => {
  const { data, error } = await createPublicClient()
    .from('categories')
    .select('id, name, slug, description, image_path, sort_order, is_public')
    .order('sort_order')
    .order('name');
  if (error) throw new CatalogReadError(error.message);
  return (data as Category[] | null) ?? [];
}, []);

/** How many published products each category has (for "120+ items" style captions). */
export const getCategoryCounts = cachedRead('category_counts', async (): Promise<Record<string, number>> => {
  const { data, error } = await createPublicClient().from('products').select('category_id').eq('status', 'published').not('category_id', 'is', null).limit(5000);
  if (error) throw new CatalogReadError(error.message);
  const counts: Record<string, number> = {};
  for (const r of (data ?? []) as { category_id: string }[]) counts[r.category_id] = (counts[r.category_id] ?? 0) + 1;
  return counts;
}, {});

/** Categories with at least one product on sale: what the menu, footer and home tiles show. */
export const getShopCategories = cachedRead('shop_categories', async (): Promise<Category[]> => {
  const { data, error } = await createPublicClient()
    .from('categories')
    .select('id, name, slug, description, image_path, sort_order, is_public, products!inner(id)')
    .eq('products.status', 'published')
    .limit(1, { referencedTable: 'products' })
    .order('sort_order')
    .order('name');
  if (error) throw new CatalogReadError(error.message);
  return ((data ?? []) as (Category & { products?: unknown })[]).map(({ products: _p, ...c }) => c as Category);
}, []);

export const getZones = cachedRead('zones', async (): Promise<DeliveryZone[]> => {
  const { data, error } = await createPublicClient()
    .from('delivery_zones')
    .select('id, name, charge, free_over, eta_text, sort_order, is_active')
    .order('sort_order');
  if (error) throw new CatalogReadError(error.message);
  return (data as DeliveryZone[] | null) ?? [];
}, []);

export const getFeaturedProducts = cache(async (limit = 8): Promise<ProductWithRelations[]> => {
  const { data, error } = await createPublicClient()
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('is_featured', true)
    .order('published_at', { ascending: false })
    .limit(limit);
  if (error) console.error('[catalog] featured', error.message);
  return ((data as unknown as ProductWithRelations[] | null) ?? []).map(sortRelations);
});

export const getNewArrivals = cache(async (limit = 8): Promise<ProductWithRelations[]> => {
  const { data, error } = await createPublicClient()
    .from('products')
    .select(PRODUCT_SELECT)
    .order('published_at', { ascending: false })
    .limit(limit);
  if (error) console.error('[catalog] new', error.message);
  return ((data as unknown as ProductWithRelations[] | null) ?? []).map(sortRelations);
});

export const getOnSale = cache(async (limit = 10): Promise<ProductWithRelations[]> => {
  const { data, error } = await createPublicClient()
    .from('products')
    .select(PRODUCT_SELECT)
    .not('compare_at_price', 'is', null)
    .order('published_at', { ascending: false })
    .limit(limit);
  if (error) console.error('[catalog] sale', error.message);
  return ((data as unknown as ProductWithRelations[] | null) ?? []).map(sortRelations);
});

/** Published products by id, in the order given (ids that are not visible are skipped). */
export const getProductsByIds = cache(async (ids: string[]): Promise<ProductWithRelations[]> => {
  if (ids.length === 0) return [];
  const { data, error } = await createPublicClient().from('products').select(PRODUCT_SELECT).in('id', ids);
  if (error) console.error('[catalog] by ids', error.message);
  const byId = new Map(((data as unknown as ProductWithRelations[] | null) ?? []).map((p) => [p.id, sortRelations(p)]));
  return ids.map((id) => byId.get(id)).filter((p): p is ProductWithRelations => !!p);
});

export const getCategoryProducts = cache(async (categoryId: string, limit = 8): Promise<ProductWithRelations[]> => {
  const { data, error } = await createPublicClient()
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('category_id', categoryId)
    .order('published_at', { ascending: false })
    .limit(limit);
  if (error) console.error('[catalog] category products', error.message);
  return ((data as unknown as ProductWithRelations[] | null) ?? []).map(sortRelations);
});

/** A photo for each category (its newest product's first photo), for category circles without their own picture. */
export const getCategoryCovers = cache(async (): Promise<Record<string, string | null>> => {
  const { data, error } = await createPublicClient()
    .from('products')
    .select('category_id, images:product_images(storage_path, sort_order)')
    .not('category_id', 'is', null)
    .order('published_at', { ascending: false })
    .limit(300);
  if (error) console.error('[catalog] covers', error.message);
  const covers: Record<string, string | null> = {};
  for (const p of (data ?? []) as { category_id: string; images: { storage_path: string; sort_order: number }[] }[]) {
    if (covers[p.category_id]) continue;
    covers[p.category_id] = [...p.images].sort((a, b) => a.sort_order - b.sort_order)[0]?.storage_path ?? null;
  }
  return covers;
});

export type HomeSectionRow ={ id: string; type: string; title: string | null; subtitle: string | null; enabled: boolean; sort_order: number; settings: unknown };

/** A theme's enabled home page sections in order; null when they cannot be read, so the page falls back to its default layout. */
export const getHomeSections = cache(async (theme: string): Promise<HomeSectionRow[] | null> => {
  const read = unstable_cache(
    async () => {
      const { data, error } = await createPublicClient()
        .from('home_sections')
        .select('id, type, title, subtitle, enabled, sort_order, settings')
        .eq('theme', theme)
        .eq('enabled', true)
        .order('sort_order')
        .order('created_at');
      if (error) throw new CatalogReadError(error.message);
      return (data ?? []) as HomeSectionRow[];
    },
    ['catalog', 'home_sections', theme],
    { tags: [CATALOG_TAG], revalidate: 300 },
  );
  try {
    return await read();
  } catch (e) {
    console.error('[catalog] home_sections', e instanceof Error ? e.message : e);
    return null;
  }
});

/** Largest real markdown (compare-at vs lowest price), for "up to N% off". */
export function maxDiscount(products: ProductWithRelations[]): number {
  let best = 0;
  for (const p of products) {
    if (p.compare_at_price === null) continue;
    const compare = toNumber(p.compare_at_price);
    const { min } = priceRange(p);
    if (compare > min) best = Math.max(best, Math.round((1 - min / compare) * 100));
  }
  return best;
}

export const getProductBySlug = cache(async (slug: string): Promise<ProductWithRelations | null> => {
  const { data, error } = await createPublicClient().from('products').select(PRODUCT_SELECT).eq('slug', slug).maybeSingle();
  if (error) console.error('[catalog] product', error.message);
  return data ? sortRelations(data as unknown as ProductWithRelations) : null;
});

export const getRelatedProducts = cache(async (productId: string, categoryId: string | null, limit = 4) => {
  if (!categoryId) return [];
  const { data } = await createPublicClient()
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('category_id', categoryId)
    .neq('id', productId)
    .order('published_at', { ascending: false })
    .limit(limit);
  return ((data as unknown as ProductWithRelations[] | null) ?? []).map(sortRelations);
});

export type ListParams = {
  q?: string;
  category?: string; // category id
  sort?: 'new' | 'price-asc' | 'price-desc' | 'name';
  inStock?: boolean;
  page?: number;
};

export const SORTS: Record<NonNullable<ListParams['sort']>, string> = {
  new: 'Newest',
  'price-asc': 'Price: low to high',
  'price-desc': 'Price: high to low',
  name: 'Name',
};

/** Escapes % and _ so a search term is matched literally by ilike. */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

type ProductList = { products: ProductWithRelations[]; total: number; page: number; pages: number };

/** A page of products, cached for five minutes or until the next catalog change. */
export function listProducts(params: ListParams): Promise<ProductList> {
  const key = JSON.stringify([params.q?.trim().slice(0, 80).toLowerCase() ?? '', params.category ?? '', params.sort ?? '', !!params.inStock, Math.floor(params.page ?? 1)]);
  return cachedRead(`list:${key}`, () => readProductList(params), { products: [], total: 0, page: 1, pages: 1 })();
}

async function readProductList(params: ListParams): Promise<ProductList> {
  const page = Math.max(1, Math.min(500, Math.floor(params.page ?? 1)));
  const from = (page - 1) * PAGE_SIZE;
  const select = params.inStock ? PRODUCT_SELECT.replace('variants:product_variants(', 'variants:product_variants!inner(') : PRODUCT_SELECT;

  let query = createPublicClient().from('products').select(select, { count: 'exact' });
  const q = params.q?.trim().slice(0, 80);
  if (q) query = query.ilike('name', `%${escapeLike(q)}%`);
  if (params.category) query = query.eq('category_id', params.category);
  // Filter on the embedded (aliased) relation; !inner drops products with no match.
  if (params.inStock) query = query.gt('variants.stock', 0);

  switch (params.sort) {
    case 'price-asc':
      query = query.order('base_price', { ascending: true });
      break;
    case 'price-desc':
      query = query.order('base_price', { ascending: false });
      break;
    case 'name':
      query = query.order('name');
      break;
    default:
      query = query.order('published_at', { ascending: false });
  }

  const { data, count, error } = await query.order('id').range(from, from + PAGE_SIZE - 1);
  // Thrown, not returned, so a failed read is never cached.
  if (error) throw new Error(error.message);
  const total = count ?? 0;
  return {
    products: ((data as unknown as ProductWithRelations[] | null) ?? []).map(sortRelations),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

// ------------------------------------------------------------- helpers

export function variantPrice(product: Pick<ProductWithRelations, 'base_price'>, v: Pick<Variant, 'price'>): number {
  return v.price === null || v.price === undefined ? toNumber(product.base_price) : toNumber(v.price);
}

/** Lowest and highest price across active variants (for "from ৳…" labels). */
export function priceRange(p: ProductWithRelations): { min: number; max: number } {
  const prices = p.variants.filter((v) => v.is_active).map((v) => variantPrice(p, v));
  if (prices.length === 0) return { min: toNumber(p.base_price), max: toNumber(p.base_price) };
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

export function totalStock(p: ProductWithRelations): number {
  return p.variants.filter((v) => v.is_active).reduce((n, v) => n + Math.max(0, v.stock), 0);
}

/** Can it be bought now? Out-of-stock pre-order and keep-selling products still can. */
export function sellable(p: ProductWithRelations): boolean {
  return p.stock_out_mode !== 'sold_out' || totalStock(p) > 0;
}

/** Shown as Pre-order: every option is out and the product takes pre-orders. */
export function isPreorder(p: ProductWithRelations): boolean {
  return p.stock_out_mode === 'preorder' && totalStock(p) <= 0;
}

export { variantLabel } from './catalog-labels';

export function stockLabel(stock: number): { text: string; tone: 'ok' | 'low' | 'out' } {
  if (stock <= 0) return { text: 'Sold out', tone: 'out' };
  if (stock <= 3) return { text: `Only ${stock} left`, tone: 'low' };
  return { text: 'In stock', tone: 'ok' };
}

export type PublicReview = { id: string; name: string; rating: number; comment: string | null; verified: boolean; created_at: string };

/** A product's approved reviews, newest first. "verified": written from a delivered order. */
export function getProductReviews(productId: string): Promise<PublicReview[]> {
  return cachedRead(`reviews:${productId}`, async () => {
    const { data, error } = await createPublicClient()
      .from('product_reviews')
      .select('id, name, rating, comment, order_id, created_at')
      .eq('product_id', productId)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({ id: r.id, name: r.name, rating: r.rating, comment: r.comment, verified: r.order_id !== null, created_at: r.created_at }));
  }, [])();
}
