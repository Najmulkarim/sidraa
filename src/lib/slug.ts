/** "Floral Maxi Dress (2026)" → "floral-maxi-dress-2026". Matches the
 *  slug check constraint in 0002_catalog.sql. Non-Latin names produce an
 *  empty slug, so the form asks for one explicitly in that case. */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
