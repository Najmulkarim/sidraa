/** Public environment, safe in browser bundles. Server-only secrets are
 *  read in src/lib/supabase/admin.ts and src/lib/rate-limit.ts only. */

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`);
  return value;
}

// NEXT_PUBLIC_* must be referenced literally so Next.js can inline them.
export const SUPABASE_URL = required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL);
export const SUPABASE_PUBLISHABLE_KEY = required(
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

export const IMAGE_BUCKET = 'product-images';

/** Public URL of an image: a file in the product-images bucket, or a site path starting with "/". */
export function imageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  // Files shipped with the site (logo in /brand, demo illustrations in /demo).
  if (path.startsWith('/')) return path;
  return `${SUPABASE_URL}/storage/v1/object/public/${IMAGE_BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`;
}
