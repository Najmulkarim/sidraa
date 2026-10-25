import { describe, expect, it } from 'vitest';
import { checkoutSchema, fieldErrors, productSchema, trackSchema, adjustStockSchema, settingsSchema } from '@/lib/validation';

const KEY = '7f3c2a10-9b1e-4c5d-8e2f-0a1b2c3d4e5f';
const V1 = 'b0000000-0000-4000-8000-000000000101';
const ZONE = '0b6c3c2e-0000-4000-8000-000000000001';

const valid = {
  idempotencyKey: KEY,
  customerName: '  Rina Akter ',
  customerPhone: '+880 1711-222333',
  address: 'House 7, Road 3, Dhanmondi',
  district: 'Dhaka',
  area: '',
  zoneId: ZONE,
  note: '',
  items: JSON.stringify([{ variantId: V1, quantity: 2 }]),
};

describe('checkoutSchema', () => {
  it('accepts a normal order and normalises fields', () => {
    const r = checkoutSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.customerName).toBe('Rina Akter');
    expect(r.data.customerPhone).toBe('01711222333');
    expect(r.data.area).toBeUndefined();
    expect(r.data.items).toEqual([{ variantId: V1, quantity: 2 }]);
  });

  it('drops any price, total or delivery the browser sends (price tampering)', () => {
    const r = checkoutSchema.safeParse({
      ...valid,
      subtotal: '1',
      total: '1',
      deliveryCharge: '0',
      items: JSON.stringify([{ variantId: V1, quantity: 1, unitPrice: 1, price: 1, lineTotal: 1 }]),
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(Object.keys(r.data)).not.toContain('total');
    expect(Object.keys(r.data)).not.toContain('subtotal');
    expect(Object.keys(r.data)).not.toContain('deliveryCharge');
    expect(r.data.items[0]).toEqual({ variantId: V1, quantity: 1 });
  });

  it('rejects an invalid phone number with a field error', () => {
    const r = checkoutSchema.safeParse({ ...valid, customerPhone: '0171' });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(fieldErrors(r.error).customerPhone).toMatch(/mobile number/);
  });

  it('rejects landline and non-BD numbers', () => {
    for (const phone of ['0212345678', '01212345678', '+14155550123']) {
      expect(checkoutSchema.safeParse({ ...valid, customerPhone: phone }).success).toBe(false);
    }
  });

  it('rejects an empty cart, malformed JSON, bad quantities and too many lines', () => {
    expect(checkoutSchema.safeParse({ ...valid, items: '[]' }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...valid, items: '{not json' }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...valid, items: JSON.stringify([{ variantId: V1, quantity: 0 }]) }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...valid, items: JSON.stringify([{ variantId: V1, quantity: 21 }]) }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...valid, items: JSON.stringify([{ variantId: V1, quantity: 1.5 }]) }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...valid, items: JSON.stringify([{ variantId: 'not-a-uuid', quantity: 1 }]) }).success).toBe(false);
    const many = Array.from({ length: 21 }, (_, i) => ({ variantId: `b0000000-0000-4000-8000-${String(i).padStart(12, '0')}`, quantity: 1 }));
    expect(checkoutSchema.safeParse({ ...valid, items: JSON.stringify(many) }).success).toBe(false);
  });

  it('requires a name, address, district, zone and idempotency key', () => {
    const r = checkoutSchema.safeParse({ ...valid, customerName: 'A', address: 'x', district: '', zoneId: 'nope', idempotencyKey: '' });
    expect(r.success).toBe(false);
    if (r.success) return;
    const fe = fieldErrors(r.error);
    for (const k of ['customerName', 'address', 'district', 'zoneId', 'idempotencyKey']) expect(fe[k]).toBeTruthy();
  });

  it('caps long text fields', () => {
    expect(checkoutSchema.safeParse({ ...valid, note: 'x'.repeat(501) }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...valid, address: 'x'.repeat(301) }).success).toBe(false);
  });
});

describe('trackSchema', () => {
  it('normalises the reference and needs exactly 4 digits', () => {
    const r = trackSchema.safeParse({ ref: 'sd 7k2m-9qxa', phoneLast4: '3456' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.ref).toBe('SD7K2M9QXA');
    expect(trackSchema.safeParse({ ref: 'SD-7K2M-9QXA', phoneLast4: '345' }).success).toBe(false);
    expect(trackSchema.safeParse({ ref: 'SD', phoneLast4: '3456' }).success).toBe(false);
  });

  it('accepts sequential order numbers, with or without the word Order', () => {
    for (const ref of ['Order0001', 'order 12', 'ORDER-0012', '0012', '7']) {
      expect(trackSchema.safeParse({ ref, phoneLast4: '3456' }).success).toBe(true);
    }
    expect(trackSchema.safeParse({ ref: 'Order', phoneLast4: '3456' }).success).toBe(false);
  });
});

describe('productSchema', () => {
  const base = {
    name: 'Floral Maxi Dress',
    slug: 'floral-maxi-dress',
    basePrice: '2450',
    status: 'published',
    variants: JSON.stringify([{ sku: 'FMD-S', size: 'S', color: '', price: null, isActive: true, openingStock: 5 }]),
  };

  it('accepts a product', () => {
    const r = productSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.basePrice).toBe(2450);
      expect(r.data.isFeatured).toBe(false);
    }
  });

  it('requires compare-at price above the price', () => {
    const r = productSchema.safeParse({ ...base, compareAtPrice: '2000' });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error).compareAtPrice).toBeTruthy();
  });

  it('rejects duplicate SKUs and duplicate size/colour pairs', () => {
    const r = productSchema.safeParse({
      ...base,
      variants: JSON.stringify([
        { sku: 'A-1', size: 'M', color: '' },
        { sku: 'a-1', size: 'm', color: '' },
      ]),
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const fe = fieldErrors(r.error);
      expect(fe['variants.1.sku']).toBeTruthy();
      expect(fe['variants.1.size']).toBeTruthy();
    }
  });

  it('rejects negative prices, bad slugs and more than 2 decimals', () => {
    expect(productSchema.safeParse({ ...base, basePrice: '-1' }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, basePrice: '10.555' }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, slug: 'Bad Slug!' }).success).toBe(false);
  });
});

describe('variant SKUs', () => {
  const product = (variants: object[]) => ({
    name: 'Tee', slug: 'tee', basePrice: '500', status: 'draft', variants: JSON.stringify(variants),
  });
  it('lets a new variation leave the SKU empty for the database to fill', () => {
    expect(productSchema.safeParse(product([{ sku: '', size: 'M', color: '' }, { sku: '', size: 'L', color: '' }])).success).toBe(true);
  });
  it('still needs a SKU on saved variations and rejects duplicates', () => {
    expect(productSchema.safeParse(product([{ id: '0b8f5a2e-1c3d-4e5f-8a9b-0c1d2e3f4a5b', sku: '', size: 'M', color: '' }])).success).toBe(false);
    expect(productSchema.safeParse(product([{ sku: 'SKU-0001', size: 'M', color: '' }, { sku: 'sku-0001', size: 'L', color: '' }])).success).toBe(false);
  });
});

describe('adjustStockSchema', () => {
  it('needs a non-zero whole number and a manual reason', () => {
    const variantId = V1;
    expect(adjustStockSchema.safeParse({ variantId, change: '0', reason: 'restock' }).success).toBe(false);
    expect(adjustStockSchema.safeParse({ variantId, change: '2.5', reason: 'restock' }).success).toBe(false);
    expect(adjustStockSchema.safeParse({ variantId, change: '-2', reason: 'order' }).success).toBe(false);
    expect(adjustStockSchema.safeParse({ variantId, change: '-2', reason: 'adjust' }).success).toBe(true);
  });
});

describe('settingsSchema', () => {
  const s = {
    storeName: 'Shop', codTerms: 'Pay the rider in cash.', returnPolicyDays: '3', orderRefPrefix: 'sd',
    lowStockThreshold: '3', themePrimary: '#6b2d3c', themeAccent: '#c9a227',
  };
  it('upper-cases the prefix and only allows https social links', () => {
    const r = settingsSchema.safeParse({ ...s, facebook: 'https://facebook.com/shop' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.orderRefPrefix).toBe('SD');
    expect(settingsSchema.safeParse({ ...s, facebook: 'javascript:alert(1)' }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...s, facebook: 'http://facebook.com/shop' }).success).toBe(false);
  });
  it('rejects colours that are not #rrggbb', () => {
    expect(settingsSchema.safeParse({ ...s, themePrimary: 'red; background:url(x)' }).success).toBe(false);
  });
});
