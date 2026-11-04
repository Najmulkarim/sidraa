import { describe, expect, it } from 'vitest';
import { productSchema } from '@/lib/validation';

const base = { name: 'Bag', slug: 'bag', basePrice: '100', status: 'draft', colorLabel: 'Color', sizeLabel: 'Size', stockOutMode: 'hide', discountStyle: 'percent', variants: JSON.stringify([{ price: null, stock: 1 }]) };
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

describe('extra categories', () => {
  it('reads a comma list, without repeats', () => {
    const r = productSchema.safeParse({ ...base, categoryId: A, extraCategoryIds: `${B}, ${B}` });
    expect(r.success && r.data.extraCategoryIds).toEqual([B]);
  });
  it('is empty when none are chosen', () => {
    const r = productSchema.safeParse({ ...base, extraCategoryIds: '' });
    expect(r.success && r.data.extraCategoryIds).toEqual([]);
  });
  it('refuses something that is not a category id', () => {
    expect(productSchema.safeParse({ ...base, extraCategoryIds: 'abc' }).success).toBe(false);
  });
});
