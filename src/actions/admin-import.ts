'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth';
import { mapDbError } from '@/lib/db-errors';
import { IMAGE_BUCKET } from '@/lib/env';
import { ImportError, imageType, safeFetch } from '@/lib/import/fetch';
import { parseProductPage } from '@/lib/import/parse';
import { slugify } from '@/lib/slug';
import type { ActionState } from '@/lib/types';

const MAX_PAGE = 8 * 1024 * 1024;
const MAX_PHOTO = 5 * 1024 * 1024;

/**
 * Creates a Draft product from a link: name, description, photos, variations and
 * (in Taka) price, whatever the page offers. It stays hidden until staff check it,
 * so a supplier's price or text can never reach customers by accident.
 */
export async function importProduct(link: string): Promise<ActionState> {
  const { supabase } = await requirePermission('catalog');
  const parsedLink = z.url().max(2000).safeParse(link.trim());
  if (!parsedLink.success) return { ok: false, message: 'Paste the full link of a product page.' };

  try {
    const page = await safeFetch(parsedLink.data, { accept: 'text/html,application/xhtml+xml', maxBytes: MAX_PAGE });
    const html = page.bytes.toString('utf8');

    let shopify: unknown;
    const handle = /^(.*\/products\/[^/?#.]+)/.exec(page.url)?.[1];
    if (handle && /shopify/i.test(html)) {
      const json = await safeFetch(`${handle}.json`, { accept: 'application/json', maxBytes: MAX_PAGE }).catch(() => null);
      if (json) {
        try {
          shopify = JSON.parse(json.bytes.toString('utf8'));
        } catch { /* fall back to the page itself */ }
      }
    }

    const p = parseProductPage(html, page.url, shopify);
    if (!p) return { ok: false, message: 'No product was found on that page. Add it by hand.' };

    const id = randomUUID();
    const slug = `${slugify(p.name).slice(0, 70) || 'product'}-${id.slice(0, 6)}`;
    const { error } = await supabase.from('products').insert({
      id, name: p.name, slug, description: p.description || null, base_price: p.price ?? 0, status: 'draft', is_featured: false,
      color_label: p.colorLabel ?? 'Color', size_label: p.sizeLabel ?? 'Size', option3_label: p.option3Label,
    });
    if (error) {
      console.error('[admin] import product', error);
      return { ok: false, message: mapDbError(error).message };
    }

    // Photos go in one at a time; a photo that fails is skipped, never the product.
    const stored = new Map<string, string>();
    let sort = 0;
    for (const src of p.images) {
      try {
        const img = await safeFetch(src, { accept: 'image/*', maxBytes: MAX_PHOTO, referer: page.url });
        const kind = imageType(img.bytes);
        if (!kind) continue;
        const path = `products/${id}/${randomUUID()}.${kind.ext}`;
        const up = await supabase.storage.from(IMAGE_BUCKET).upload(path, img.bytes, { contentType: kind.type, cacheControl: '31536000', upsert: false });
        if (up.error) continue;
        const row = await supabase.from('product_images').insert({ product_id: id, storage_path: path, alt: p.name.slice(0, 200), sort_order: sort });
        if (row.error) continue;
        stored.set(src, path);
        sort++;
      } catch { /* blocked or broken photo: skip it */ }
    }

    const rows = p.variants.length
      ? p.variants.map((v) => ({ product_id: id, color: v.color, size: v.size, option3: v.option3, price: v.price, stock: 0, image_path: v.image ? stored.get(v.image) ?? null : null }))
      : [{ product_id: id, stock: 0 }];
    const { error: varError } = await supabase.from('product_variants').insert(rows);
    if (varError) console.error('[admin] import variants', varError);

    revalidatePath('/admin/products');
    const notes = [
      `${stored.size} of ${p.images.length} photos`,
      `${varError ? 0 : p.variants.length} variations`,
      p.price === null ? 'price not in Taka: set it yourself' : null,
    ].filter(Boolean).join(' · ');
    return { ok: true, message: `Imported as Draft. ${notes}.`, values: { productId: id } };
  } catch (e) {
    if (e instanceof ImportError) return { ok: false, message: e.message };
    console.error('[admin] import', e);
    return { ok: false, message: 'Could not read that page. Add this product by hand.' };
  }
}
