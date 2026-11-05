/**
 * Product tags: short words staff give products ("Eid Sale", "Best seller",
 * "নতুন"). Each tag is also a collection on the website: /collections/<tagSlug>.
 */
export const MAX_TAGS = 20;
export const MAX_TAG_LENGTH = 40;
// Letters (any language), numbers, spaces and a few marks; no commas, quotes or braces.
const TAG_RE = /^[\p{L}\p{N}][\p{L}\p{N}\p{M} &'+.\-]*$/u;

/** One tag tidied (extra spaces gone), or null when it cannot be a tag. */
export function cleanTag(raw: string): string | null {
  const t = raw.replace(/\s+/g, ' ').trim();
  if (!t || t.length > MAX_TAG_LENGTH || !TAG_RE.test(t)) return null;
  return t;
}

/** Tags from a list or "a, b, c": cleaned, no repeats (case ignored), at most 20. */
export function cleanTags(input: unknown): string[] {
  const list = Array.isArray(input) ? input.map(String) : String(input ?? '').split(',');
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of list) {
    const t = cleanTag(raw);
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
    if (out.length === MAX_TAGS) break;
  }
  return out;
}

/** "Eid Sale" → "eid-sale" (Bangla stays as it is): the collection's web address. */
export function tagSlug(tag: string): string {
  return tag.toLowerCase().replace(/[\s&'+.]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

export const tagHref = (tag: string) => `/collections/${encodeURIComponent(tagSlug(tag))}`;

/** Every spelling of a tag that leads to this address ("Eid Sale", "eid sale"). */
export function tagsForSlug(all: string[], slug: string): string[] {
  const want = decodeURIComponent(slug).toLowerCase();
  return [...new Set(all.filter((t) => tagSlug(t) === want))];
}

/** All tags in use, most used first (for suggestions and the collections list). */
export function countTags(rows: { tags: string[] | null }[]): { tag: string; count: number }[] {
  const by = new Map<string, { tag: string; count: number }>();
  for (const r of rows) for (const t of r.tags ?? []) {
    const k = t.toLowerCase();
    const cur = by.get(k);
    if (cur) cur.count++;
    else by.set(k, { tag: t, count: 1 });
  }
  return [...by.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}
