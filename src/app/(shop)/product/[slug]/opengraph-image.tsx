import sharp from 'sharp';
import { getProductBySlug } from '@/lib/catalog';
import { imageUrl, SITE_URL } from '@/lib/env';

/**
 * The picture shown when a product link is shared (Messenger, Facebook,
 * WhatsApp): the main photo, fitted on a white 1200×630 card. A fixed size
 * lets Facebook show it the first time the link is shared.
 */
export const alt = 'Product photo';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/jpeg';

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

async function photo(url: string | null): Promise<Buffer | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  const main = await photo(imageUrl(p?.images[0]?.storage_path));
  const logo = main ? null : await photo(`${SITE_URL}/brand/logo-light.png`);

  let card = sharp({ create: { width: size.width, height: size.height, channels: 4, background: WHITE } });
  const source = main ?? logo;
  if (source) {
    const fitted = await sharp(source).rotate().resize(size.width, size.height, { fit: 'contain', background: WHITE }).toBuffer().catch(() => null);
    if (fitted) card = card.composite([{ input: fitted }]);
  }
  const jpg = await card.flatten({ background: WHITE }).jpeg({ quality: 85, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(jpg), { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=3600, s-maxage=86400' } });
}
