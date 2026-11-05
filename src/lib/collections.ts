import { z } from 'zod';
import { cleanTag } from './tags';

/**
 * Collections (like Shopify): products join by rules — tag, category, name,
 * SKU, price — matched "any" or "all", plus products picked by hand.
 */
export const RULE_FIELDS = {
  tag: { label: 'Tag', ops: { is: 'is' } },
  category: { label: 'Category', ops: { is: 'is' } },
  name: { label: 'Product name', ops: { contains: 'contains', starts: 'starts with', is: 'is exactly' } },
  sku: { label: 'SKU', ops: { starts: 'starts with', is: 'is exactly', contains: 'contains' } },
  price: { label: 'Price', ops: { lte: 'is at most ৳', gte: 'is at least ৳' } },
} as const;
export type RuleField = keyof typeof RULE_FIELDS;
export type Rule = { field: RuleField; op: string; value: string };

export type CollectionRow = {
  id: string; name: string; slug: string; description: string | null; is_public: boolean;
  match: 'any' | 'all'; rules: Rule[]; product_ids: string[]; sort_order: number; created_at?: string; updated_at?: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const ruleSchema = z
  .object({ field: z.enum(Object.keys(RULE_FIELDS) as [RuleField, ...RuleField[]]), op: z.string().max(20), value: z.string().trim().min(1, 'Fill in every rule').max(80) })
  .superRefine((r, ctx) => {
    if (!(r.op in RULE_FIELDS[r.field].ops)) ctx.addIssue({ code: 'custom', message: 'Unknown rule' });
    if (r.field === 'category' && !UUID.test(r.value)) ctx.addIssue({ code: 'custom', message: 'Choose a category' });
    if (r.field === 'tag' && !cleanTag(r.value)) ctx.addIssue({ code: 'custom', message: 'Choose a tag' });
    if (r.field === 'price' && !(Number(r.value) >= 0)) ctx.addIssue({ code: 'custom', message: 'Price must be a number' });
  });

/** A value in a PostgREST filter: quoted, so commas and brackets in it are plain text. */
const quote = (v: string) => `"${v.replace(/[\\"]/g, (c) => `\\${c}`)}"`;
/** Text for ilike: no wildcards of its own. */
const plain = (v: string) => v.replace(/[*%_\\"]/g, '');

/**
 * One rule as a PostgREST filter. family: a category with its child categories.
 * tagSpellings: every spelling of a tag in use ("Eid Sale", "eid sale").
 */
export function ruleFilter(r: Rule, family: (id: string) => string[], tagSpellings: (tag: string) => string[]): string | null {
  switch (r.field) {
    case 'tag': {
      const tags = tagSpellings(r.value).filter((t) => cleanTag(t));
      return tags.length ? `tags.ov.{${tags.join(',')}}` : null;
    }
    case 'category': {
      const ids = family(r.value).filter((id) => UUID.test(id));
      return ids.length ? `or(category_id.in.(${ids.join(',')}),extra_category_ids.ov.{${ids.join(',')}})` : null;
    }
    case 'name':
    case 'sku': {
      const v = plain(r.value).trim();
      if (!v) return null;
      if (r.op === 'is') return `${r.field}.ilike.${quote(v)}`;
      return `${r.field}.ilike.${quote(r.op === 'starts' ? `${v}*` : `*${v}*`)}`;
    }
    case 'price': {
      const n = Number(r.value);
      return Number.isFinite(n) && n >= 0 && (r.op === 'lte' || r.op === 'gte') ? `base_price.${r.op}.${n}` : null;
    }
  }
}

/** The whole collection as one filter for .or(…), or null when nothing can match. */
export function collectionFilter(c: Pick<CollectionRow, 'match' | 'rules' | 'product_ids'>, family: (id: string) => string[], tagSpellings: (tag: string) => string[]): string | null {
  const rules = c.rules.map((r) => ruleFilter(r, family, tagSpellings));
  const parts: string[] = [];
  const ids = c.product_ids.filter((id) => UUID.test(id));
  if (ids.length) parts.push(`id.in.(${ids.join(',')})`);
  if (c.match === 'all') {
    // Every rule must hold; a rule that can never match (a tag no product has) empties it.
    if (rules.length && rules.every(Boolean)) parts.push(rules.length === 1 ? rules[0]! : `and(${rules.join(',')})`);
  } else {
    parts.push(...rules.filter((r): r is string => !!r));
  }
  return parts.length ? parts.join(',') : null;
}

/** "Tag is Eid Sale, or Price is at most ৳500" — for the admin list. */
export function describeRules(c: Pick<CollectionRow, 'match' | 'rules' | 'product_ids'>, categoryName: (id: string) => string | undefined): string {
  const words = c.rules.map((r) => {
    const f = RULE_FIELDS[r.field];
    const op = (f.ops as Record<string, string>)[r.op] ?? r.op;
    const value = r.field === 'category' ? (categoryName(r.value) ?? 'a deleted category') : r.value;
    return `${f.label} ${op}${op.endsWith('৳') ? '' : ' '}${value}`;
  });
  const joined = words.join(c.match === 'all' ? ' and ' : ' or ');
  const picked = c.product_ids.length ? `${c.product_ids.length} picked product${c.product_ids.length === 1 ? '' : 's'}` : '';
  return [joined, picked].filter(Boolean).join(' + ') || 'No rules yet';
}
