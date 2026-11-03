'use server';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth';
import { IMAGE_BUCKET, imageUrl } from '@/lib/env';
import { ImportError, imageType, safeFetch } from '@/lib/import/fetch';

const MAX_PHOTO = 5 * 1024 * 1024;

/**
 * A picture for a product description, from a link: copied into the site's own
 * photo storage, so it keeps working if the other website removes it (and the
 * site's security rules only show pictures from its own storage).
 */
export async function copyDescriptionImage(productId: string, link: string): Promise<{ url: string } | { error: string }> {
  const { supabase } = await requirePermission('catalog');
  const id = z.uuid().safeParse(productId);
  const url = z.url().max(2000).safeParse(link.trim());
  if (!id.success) return { error: 'Save the product first, then add pictures.' };
  if (!url.success) return { error: 'Paste the full picture link (it starts with http).' };
  try {
    const img = await safeFetch(url.data, { accept: 'image/avif,image/webp,image/png,image/jpeg,image/*', maxBytes: MAX_PHOTO });
    const kind = imageType(img.bytes);
    if (!kind) return { error: 'That link is not a JPG, PNG, WebP or AVIF picture.' };
    const path = `products/${id.data}/${randomUUID()}.${kind.ext}`;
    const up = await supabase.storage.from(IMAGE_BUCKET).upload(path, img.bytes, { contentType: kind.type, cacheControl: '31536000', upsert: false });
    if (up.error) return { error: `The picture could not be saved (${up.error.message}).` };
    return { url: imageUrl(path)! };
  } catch (e) {
    if (e instanceof ImportError) return { error: e.message === 'That file is too large.' ? 'That picture is larger than 5 MB.' : e.message };
    return { error: 'That picture could not be copied. Download it to your computer and upload it instead.' };
  }
}
