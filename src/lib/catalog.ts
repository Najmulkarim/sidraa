/**
 * Public catalogue queries. All go through the cookieless client, so RLS
 * returns only published products, active variants and public categories.
 * React cache() de-duplicates calls within one render.
 */
import { cache } from 'react';
import { createPublicClient } from '@/lib/supabase/public';
import { toNumber } from '@/lib/format';
import { sizeRank } from './sizes';
import type { Category, DeliveryZone, ProductWithRelations, StoreSettings, Variant } from '@/lib/types';

export const PRODUCT_SELECT =
  'id, category_id, name, slug, description, base_price, compare_at_price, status, is_featured, seo_title, seo_description, color_label, size_label, option3_label, published_at, created_at, updated_at,' +
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
};

function sortRelations(p: ProductWithRelations): ProductWithRelations {
  return {
    ...p,
    images: [...(p.images ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    variants: [...(p.variants ?? [])].sort((a, b) => sizeRank(a.size) - sizeRank(b.size) || a.sku.localeCompare(b.sku)),
  };
}

export { sizeRank } from './sizes';

export const getSettings = cache(async (): Promise<StoreSettings> => {
  const { data, error } = await createPublicClient()
    .from('store_settings')
    .select('store_name, tagline, logo_path, theme, phone, email, address, social, cod_terms, return_policy_days, order_ref_prefix, low_stock_threshold, fb_pixel_id, announcement, coupons_enabled')
    .eq('id', 1)
    .maybeSingle();
  if (error) console.error('[catalog] settings', error.message);
  return (data as StoreSettings | null) ?? FALLBACK_SETTINGS;
});

export const getCategories = cache(async (): Promise<Category[]> => {
  const { data, error } = await createPublicClient()
    .from('categories')
    .select('id, name, slug, description, image_path, sort_order, is_public')
    .order('sort_order')
    .order('name');
  if (error) console.error('[catalog] categories', error.message);
  return (data as Category[] | null) ?? [];
});

export const getZones = cache(async (): Promise<DeliveryZone[]> => {
  const { data, error } = await createPublicClient()
    .from('delivery_zones')
    .select('id, name, charge, free_over, eta_text, sort_order, is_active')
    .order('sort_order');
  if (error) console.error('[catalog] zones', error.message);
  return (data as DeliveryZone[] | null) ?? [];
});

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

export async function listProducts(params: ListParams): Promise<{ products: ProductWithRelations[]; total: number; page: number; pages: number }> {
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
  if (error) console.error('[catalog] list', error.message);
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
  return p.variants.filter((v) => v.is_active).reduce((n, v) => n + v.stock, 0);
}

export { variantLabel } from './catalog-labels';

export function stockLabel(stock: number): { text: string; tone: 'ok' | 'low' | 'out' } {
  if (stock <= 0) return { text: 'Sold out', tone: 'out' };
  if (stock <= 3) return { text: `Only ${stock} left`, tone: 'low' };
  return { text: 'In stock', tone: 'ok' };
}
