/**
 * Pictures placed in descriptions and landing-page posters keep their own
 * shape (a plain <img>), but our own photos still go through the image
 * optimiser: a phone gets a 640–828 px WebP/AVIF copy instead of the
 * original upload. Widths must be in next.config `deviceSizes`.
 */
import { SUPABASE_URL } from './env';

const WIDTHS = [640, 828, 1080] as const;
const own = (src: string) => src.startsWith(`${SUPABASE_URL}/storage/v1/object/public/`);
const via = (src: string, w: number) => `/_next/image?url=${encodeURIComponent(src)}&w=${w}&q=75`;

/** src + srcSet for a full-width picture; other sites' pictures are left as they are. */
export function responsiveImage(src: string): { src: string; srcSet?: string } {
  if (!own(src)) return { src };
  return { src: via(src, 1080), srcSet: WIDTHS.map((w) => `${via(src, w)} ${w}w`).join(', ') };
}
