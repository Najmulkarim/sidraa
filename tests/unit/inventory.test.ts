import { describe, expect, it } from 'vitest';
import { filterRows, inventoryCsv, stockOrderTotals, stockStatus, totals, type InventoryRow } from '@/lib/inventory';

const row = (o: Partial<InventoryRow>): InventoryRow => ({
  id: 'v1', productId: 'p1', name: 'Silk Scarf', variant: 'Red / M', sku: 'SC-1', category: 'Scarf', categoryId: 'c1', image: null, stock: 10, active: true, cost: 100, ...o,
});

describe('inventory', () => {
  it('stock status by the reorder level', () => {
    expect(stockStatus(0, 3)).toBe('out');
    expect(stockStatus(-1, 3)).toBe('out');
    expect(stockStatus(3, 3)).toBe('low');
    expect(stockStatus(4, 3)).toBe('in');
  });
  it('filters by search, category and status', () => {
    const rows = [row({}), row({ id: 'v2', name: 'Slippers', sku: 'SL-9', variant: 'Pink / 36-37', categoryId: 'c2', stock: 2 }), row({ id: 'v3', stock: 0 })];
    expect(filterRows(rows, { q: 'pink', category: '', status: '' }, 3).map((r) => r.id)).toEqual(['v2']);
    expect(filterRows(rows, { q: 'sc-1', category: '', status: '' }, 3).map((r) => r.id)).toEqual(['v1', 'v3']);
    expect(filterRows(rows, { q: '', category: 'c2', status: '' }, 3).map((r) => r.id)).toEqual(['v2']);
    expect(filterRows(rows, { q: '', category: '', status: 'need' }, 3).map((r) => r.id)).toEqual(['v2', 'v3']);
    expect(filterRows(rows, { q: '', category: '', status: 'out' }, 3).map((r) => r.id)).toEqual(['v3']);
  });
  it('totals: units, value at cost, and rows without a cost', () => {
    const t = totals([row({ stock: 10, cost: 100 }), row({ stock: 2, cost: null }), row({ stock: -1, cost: 50 }), row({ stock: 0, cost: null })], 3);
    expect(t).toEqual({ records: 4, units: 12, value: 1000, valueMissing: 1, low: 1, out: 2 });
  });
  it('CSV for Excel: safe cells, cost columns only when allowed', () => {
    const csv = inventoryCsv([row({ name: '=HYPERLINK("x")', variant: 'A, B' })], 3, true);
    expect(csv.startsWith('﻿SKU,Product')).toBe(true);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain('"A, B"');
    expect(csv).toContain('100,1000');
    expect(inventoryCsv([row({})], 3, false)).not.toContain('Cost price');
  });
  it('stock-in order totals', () => {
    expect(stockOrderTotals([{ quantity: 5, unit_cost: 200 }, { quantity: 3, unit_cost: null }])).toEqual({ lines: 2, units: 8, cost: 1000 });
  });
});
