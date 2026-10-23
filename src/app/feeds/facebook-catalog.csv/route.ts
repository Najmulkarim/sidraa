import { getSettings, priceRange, PRODUCT_SELECT, totalStock } from '@/lib/catalog';
import { toCsv } from '@/lib/csv';
import { imageUrl, SITE_URL } from '@/lib/env';
import { createPublicClient } from '@/lib/supabase/public';
import type { ProductWithRelations } from '@/lib/types';

/**
 * Product feed for a Facebook / Instagram catalog (Commerce Manager →
 * Catalog → Data sources → Data feed → scheduled feed URL):
 *   https://<your-domain>/feeds/facebook-catalog.csv
 * Only published products — the same data anyone can see in the shop.
 * The id is the product id, matching the Pixel's content_ids.
 */
export const revalidate = 3600;

export async function GET() {
  const [settings, { data, error }] = await Promise.all([
    getSettings(),
    createPublicClient().from('products').select(PRODUCT_SELECT).eq('status', 'published').order('created_at', { ascending: false }).limit(5000),
  ]);
  if (error) return new Response('Feed unavailable', { status: 503 });

  const abs = (p: string | null) => {
    const u = imageUrl(p);
    return !u ? '' : u.startsWith('/') ? `${SITE_URL}${u}` : u;
  };
  const rows = ((data ?? []) as unknown as ProductWithRelations[])
    .filter((p) => p.images.length > 0)
    .map((p) => {
      const { min } = priceRange(p);
      const compare = p.compare_at_price === null ? null : Number(p.compare_at_price);
      const images = [...p.images].sort((a, b) => a.sort_order - b.sort_order);
      const onSale = compare !== null && compare > min;
      return [
        p.id,
        p.name.slice(0, 150),
        (p.description ?? p.name).replace(/\s+/g, ' ').slice(0, 5000),
        totalStock(p) > 0 ? 'in stock' : 'out of stock',
        'new',
        `${(onSale ? compare! : min).toFixed(2)} BDT`,
        onSale ? `${min.toFixed(2)} BDT` : '',
        `${SITE_URL}/product/${p.slug}`,
        abs(images[0]!.storage_path),
        images.slice(1, 10).map((i) => abs(i.storage_path)).join(','),
        settings.store_name,
        p.category?.name ?? '',
      ];
    });

  const csv = toCsv(
    ['id', 'title', 'description', 'availability', 'condition', 'price', 'sale_price', 'link', 'image_link', 'additional_image_link', 'brand', 'product_type'],
    rows,
  ).replace(/^﻿/, '');
  return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
