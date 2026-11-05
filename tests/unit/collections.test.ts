import { describe, expect, it } from 'vitest';
import { collectionFilter, describeRules, ruleFilter, ruleSchema } from '@/lib/collections';

const fam = (id: string) => [id, 'c2c2c2c2-0000-4000-8000-000000000000'];
const sp = (t: string) => (t.toLowerCase() === 'eid sale' ? ['Eid Sale', 'eid sale'] : []);
const CAT = 'c1c1c1c1-0000-4000-8000-000000000000';
const P = 'p1p1p1p1-0000-4000-8000-000000000000'.replace(/p/g, 'a');

describe('collection rules', () => {
  it('turns rules into filters', () => {
    expect(ruleFilter({ field: 'tag', op: 'is', value: 'Eid Sale' }, fam, sp)).toBe('tags.ov.{Eid Sale,eid sale}');
    expect(ruleFilter({ field: 'tag', op: 'is', value: 'Nobody' }, fam, sp)).toBeNull();
    expect(ruleFilter({ field: 'category', op: 'is', value: CAT }, fam, sp)).toBe(`or(category_id.in.(${CAT},c2c2c2c2-0000-4000-8000-000000000000),extra_category_ids.ov.{${CAT},c2c2c2c2-0000-4000-8000-000000000000})`);
    expect(ruleFilter({ field: 'name', op: 'contains', value: 'silk, "scarf" 50%' }, fam, sp)).toBe('name.ilike."*silk, scarf 50*"');
    expect(ruleFilter({ field: 'sku', op: 'starts', value: 'SKU-004' }, fam, sp)).toBe('sku.ilike."SKU-004*"');
    expect(ruleFilter({ field: 'price', op: 'lte', value: '700' }, fam, sp)).toBe('base_price.lte.700');
  });
  it('joins rules for any / all, with picked products always in', () => {
    const rules = [{ field: 'sku' as const, op: 'starts', value: 'SKU-004' }, { field: 'price' as const, op: 'lte', value: '700' }];
    expect(collectionFilter({ match: 'any', rules, product_ids: [] }, fam, sp)).toBe('sku.ilike."SKU-004*",base_price.lte.700');
    expect(collectionFilter({ match: 'all', rules, product_ids: [P] }, fam, sp)).toBe(`id.in.(${P}),and(sku.ilike."SKU-004*",base_price.lte.700)`);
    expect(collectionFilter({ match: 'all', rules: [...rules, { field: 'tag', op: 'is', value: 'Nobody' }], product_ids: [] }, fam, sp)).toBeNull();
    expect(collectionFilter({ match: 'any', rules: [], product_ids: [] }, fam, sp)).toBeNull();
  });
  it('checks rules and describes them', () => {
    expect(ruleSchema.safeParse({ field: 'price', op: 'contains', value: '5' }).success).toBe(false);
    expect(ruleSchema.safeParse({ field: 'category', op: 'is', value: 'x' }).success).toBe(false);
    expect(describeRules({ match: 'any', rules: [{ field: 'category', op: 'is', value: CAT }, { field: 'price', op: 'lte', value: '500' }], product_ids: [P] }, () => 'Bags'))
      .toBe('Category is Bags or Price is at most ৳500 + 1 picked product');
  });
});
