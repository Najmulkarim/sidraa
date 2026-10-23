import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/env';
import { createPublicClient } from '@/lib/supabase/public';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = createPublicClient();
  const [{ data: products }, { data: categories }] = await Promise.all([
    db.from('products').select('slug, updated_at').order('updated_at', { ascending: false }).limit(5000),
    db.from('categories').select('slug, updated_at'),
  ]);

  const staticPages: MetadataRoute.Sitemap = ['', '/products', '/track', '/info/delivery', '/info/returns', '/info/privacy', '/info/terms'].map(
    (path) => ({ url: `${SITE_URL}${path}`, changeFrequency: path === '' ? 'daily' : 'weekly', priority: path === '' ? 1 : 0.5 }),
  );

  return [
    ...staticPages,
    ...((categories as { slug: string; updated_at: string }[] | null) ?? []).map((c) => ({
      url: `${SITE_URL}/category/${c.slug}`,
      lastModified: c.updated_at,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    ...((products as { slug: string; updated_at: string }[] | null) ?? []).map((p) => ({
      url: `${SITE_URL}/product/${p.slug}`,
      lastModified: p.updated_at,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ];
}
