import { describe, expect, it } from 'vitest';
import { cartReducer, parseCart, toOrderItems, MAX_LINES, type CartLine } from '@/lib/cart';
import { csvCell, toCsv } from '@/lib/csv';
import { mapDbError } from '@/lib/db-errors';
import { addDays, dhakaDayStartUtc, dhakaToday, formatTaka, isYmd, resolveRange } from '@/lib/format';
import { canTransition, isEditable, nextStatuses } from '@/lib/order-status';
import { maskBdPhone, normalizeBdPhone } from '@/lib/phone';
import { canonicalRef } from '@/lib/order-ref';
import { slugify } from '@/lib/slug';

const V = (n: number) => `b0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

describe('phone', () => {
  it('normalises the common ways people type a BD mobile number', () => {
    for (const input of ['01711222333', '+8801711222333', '8801711222333', '017-1122-2333', ' 01711 222333 ']) {
      expect(normalizeBdPhone(input)).toBe('01711222333');
    }
  });
  it('rejects everything else', () => {
    for (const input of ['', '0171122233', '011711222333', '01211222333', '+447700900123', null, undefined]) {
      expect(normalizeBdPhone(input)).toBeNull();
    }
  });
  it('masks the middle digits', () => {
    expect(maskBdPhone('01711222333')).toBe('017•••••333');
  });
});

describe('format', () => {
  it('formats taka with English digits', () => {
    expect(formatTaka(1234.5)).toBe('৳1,234.5');
    expect(formatTaka('2450.00')).toBe('৳2,450');
    expect(formatTaka(null)).toBe('৳0');
  });
  it('computes Dhaka calendar days (UTC+6)', () => {
    expect(dhakaToday(new Date('2026-10-22T18:30:00Z'))).toBe('2026-10-23');
    expect(dhakaToday(new Date('2026-10-22T17:59:00Z'))).toBe('2026-10-22');
    expect(dhakaDayStartUtc('2026-10-23')).toBe('2026-10-22T18:00:00.000Z');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
  });
  it('validates dates', () => {
    expect(isYmd('2026-02-29')).toBe(false);
    expect(isYmd('2024-02-29')).toBe(true);
    expect(isYmd('2026-13-01')).toBe(false);
  });
  it('resolves range presets', () => {
    const now = new Date('2026-10-23T06:00:00Z');
    expect(resolveRange('today', undefined, undefined, now)).toEqual({ preset: 'today', from: '2026-10-23', to: '2026-10-23' });
    expect(resolveRange(undefined, undefined, undefined, now)).toEqual({ preset: '7d', from: '2026-10-17', to: '2026-10-23' });
    expect(resolveRange('last-month', undefined, undefined, now)).toEqual({ preset: 'last-month', from: '2026-09-01', to: '2026-09-30' });
    expect(resolveRange('this-month', undefined, undefined, new Date('2026-01-10T00:00:00Z')).from).toBe('2026-01-01');
    expect(resolveRange('last-month', undefined, undefined, new Date('2026-01-10T00:00:00Z'))).toMatchObject({ from: '2025-12-01', to: '2025-12-31' });
    expect(resolveRange('custom', '2026-10-20', '2026-10-01', now)).toEqual({ preset: 'custom', from: '2026-10-01', to: '2026-10-20' });
    expect(resolveRange('custom', '2020-01-01', '2026-10-01', now).from).toBe('2025-09-30');
    expect(resolveRange('custom', 'bad', '2026-10-01', now).preset).toBe('7d');
    expect(resolveRange('yesterday', undefined, undefined, now)).toMatchObject({ from: '2026-10-22', to: '2026-10-22' });
    expect(resolveRange('this-year', undefined, undefined, now)).toMatchObject({ from: '2026-01-01', to: '2026-10-23' });
    expect(resolveRange('90d', undefined, undefined, now).from).toBe('2026-07-26');
  });
});

describe('order status workflow (mirrors allowed_next_statuses)', () => {
  it('allows forward moves, hold / ship later, cancel or fake while open', () => {
    expect(nextStatuses('pending')).toEqual(['confirmed', 'processing', 'shipped', 'delivered', 'hold', 'ship_later', 'cancelled', 'fake']);
    expect(nextStatuses('hold')).toContain('confirmed');
    expect(nextStatuses('shipped')).toEqual(['delivered', 'returned', 'lost']);
    expect(nextStatuses('delivered')).toEqual(['returned']);
  });
  it('final statuses go nowhere', () => {
    for (const s of ['cancelled', 'returned', 'lost', 'fake'] as const) expect(nextStatuses(s)).toEqual([]);
  });
  it('never moves backwards along the main flow', () => {
    const flow = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'] as const;
    flow.forEach((from, i) => flow.slice(0, i + 1).forEach((to) => expect(canTransition(from, to)).toBe(false)));
    expect(canTransition('processing', 'returned')).toBe(false);
    expect(canTransition('shipped', 'cancelled')).toBe(false);
  });
  it('only lets customer details change before the courier has the parcel', () => {
    expect(isEditable('hold')).toBe(true);
    expect(isEditable('shipped')).toBe(false);
  });
});

describe('csv', () => {
  it('neutralises spreadsheet formulas and quotes fields', () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(csvCell('+8801711')).toBe(`"'+8801711"`);
    expect(csvCell(-5)).toBe('"-5"');
    expect(csvCell(null)).toBe('""');
    const out = toCsv(['a', 'b'], [[1, 'x,y']]);
    expect(out.startsWith('﻿"a","b"\r\n"1","x,y"')).toBe(true);
  });
});

describe('slug', () => {
  it('makes URL-safe slugs', () => {
    expect(slugify('Floral Maxi Dress (2026)')).toBe('floral-maxi-dress-2026');
    expect(slugify('  Crème Brûlée  ')).toBe('creme-brulee');
    expect(slugify('শাড়ি')).toBe('');
  });
});

describe('cart', () => {
  it('ignores tampered or malformed localStorage', () => {
    expect(parseCart('not json')).toEqual([]);
    expect(parseCart('{"a":1}')).toEqual([]);
    const lines = parseCart(
      JSON.stringify([
        { variantId: V(1), quantity: 2, unitPrice: 1 },
        { variantId: 'x', quantity: 1 },
        { variantId: V(2), quantity: -1 },
        { variantId: V(3), quantity: 999 },
        { variantId: V(1), quantity: 1 },
      ]),
    );
    expect(lines.map((l) => [l.variantId, l.quantity])).toEqual([
      [V(1), 3],
      [V(3), 20],
    ]);
    expect(toOrderItems(lines)[0]).toEqual({ variantId: V(1), quantity: 3 });
  });

  it('adds, merges, clamps and removes', () => {
    let s: CartLine[] = [];
    s = cartReducer(s, { type: 'add', line: { variantId: V(1), quantity: 2 } });
    s = cartReducer(s, { type: 'add', line: { variantId: V(1), quantity: 30 } });
    expect(s).toHaveLength(1);
    expect(s[0]!.quantity).toBe(20);
    s = cartReducer(s, { type: 'setQty', variantId: V(1), quantity: 0 });
    expect(s).toEqual([]);
    for (let i = 0; i < MAX_LINES + 3; i++) s = cartReducer(s, { type: 'add', line: { variantId: V(i), quantity: 1 } });
    expect(s).toHaveLength(MAX_LINES);
  });
});

describe('db errors', () => {
  it('turns OUT_OF_STOCK details into a readable message', () => {
    const m = mapDbError({
      code: 'P0001',
      message: 'OUT_OF_STOCK',
      details: JSON.stringify([
        { variant_id: V(1), product_name: 'Floral Maxi Dress', variant_label: 'XL', requested: 2, available: 1 },
        { variant_id: V(2), product_name: null, variant_label: null, requested: 1, available: 0 },
      ]),
    });
    expect(m.code).toBe('OUT_OF_STOCK');
    expect(m.message).toBe('Floral Maxi Dress (XL): only 1 left, you asked for 2. An item in your cart is sold out.');
    expect(m.stock).toHaveLength(2);
  });
  it('maps field errors and hides unknown errors', () => {
    expect(mapDbError({ message: 'INVALID_INPUT', details: '{"field":"customer_phone","reason":"Bad phone"}' })).toMatchObject({ field: 'customer_phone', message: 'Bad phone' });
    expect(mapDbError({ message: 'relation "x" does not exist', code: '42P01' }).message).toBe('Something went wrong. Please try again.');
    expect(mapDbError({ message: 'duplicate key', code: '23505' }).code).toBe('DUPLICATE');
  });
});

describe('order numbers in links', () => {
  it('accepts Order0001 in any case and old SD- references', () => {
    expect(canonicalRef('Order0002')).toBe('Order0002');
    expect(canonicalRef('ORDER0002')).toBe('Order0002');
    expect(canonicalRef('order12345')).toBe('Order12345');
    expect(canonicalRef('sd-33wh-wmkc')).toBe('SD-33WH-WMKC');
  });
  it('rejects anything else', () => {
    for (const v of ['Order12', 'Orderxyz', '', 'DROP TABLE']) expect(canonicalRef(v)).toBeNull();
  });
});
