/**
 * Inventory page helpers: stock status, filters and totals over the shop's
 * variations. Pure — tested in tests/unit/inventory.test.ts.
 */

export type StockStatus = 'in' | 'low' | 'out';

export type InventoryRow = {
  id: string;
  productId: string;
  name: string;
  variant: string;
  sku: string;
  category: string | null;
  categoryId: string | null;
  image: string | null;
  stock: number;
  active: boolean;
  /** Cost of one unit (variation's own, else the product's); null = not entered or not allowed to see. */
  cost: number | null;
};

export const STATUS_LABEL: Record<StockStatus, string> = { in: 'In stock', low: 'Low stock', out: 'Out of stock' };

export function stockStatus(stock: number, threshold: number): StockStatus {
  if (stock <= 0) return 'out';
  return stock <= threshold ? 'low' : 'in';
}

/** status 'need': low or out (the Low stock tab). */
export type InventoryFilter = { q: string; category: string; status: '' | StockStatus | 'need' };

/** Search matches the product name, the SKU or the variation (case does not matter). */
export function filterRows(rows: InventoryRow[], f: InventoryFilter, threshold: number): InventoryRow[] {
  const q = f.q.trim().toLowerCase();
  return rows.filter(
    (r) =>
      (!q || r.name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q) || r.variant.toLowerCase().includes(q)) &&
      (!f.category || r.categoryId === f.category) &&
      (!f.status || (f.status === 'need' ? stockStatus(r.stock, threshold) !== 'in' : stockStatus(r.stock, threshold) === f.status)),
  );
}

export type InventoryTotals = { records: number; units: number; value: number; valueMissing: number; low: number; out: number };

/** Totals for the cards: units in stock, their value at cost (rows without a cost are counted apart). */
export function totals(rows: InventoryRow[], threshold: number): InventoryTotals {
  const t: InventoryTotals = { records: rows.length, units: 0, value: 0, valueMissing: 0, low: 0, out: 0 };
  for (const r of rows) {
    const units = Math.max(0, r.stock);
    t.units += units;
    if (r.cost === null) { if (units > 0) t.valueMissing += 1; }
    else t.value += units * r.cost;
    const s = stockStatus(r.stock, threshold);
    if (s === 'low') t.low += 1;
    if (s === 'out') t.out += 1;
  }
  t.value = Math.round(t.value * 100) / 100;
  return t;
}

/** Spreadsheet (CSV, opens in Excel) of the rows as shown. */
export function inventoryCsv(rows: InventoryRow[], threshold: number, withCost: boolean): string {
  const head = ['SKU', 'Product', 'Variation', 'Category', 'Stock', 'Reorder level', 'Status', ...(withCost ? ['Cost price', 'Stock value'] : [])];
  const cell = (v: string | number) => {
    const s = String(v);
    // A leading = + - @ would run as a formula in Excel.
    const safe = /^[=+\-@]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const lines = rows.map((r) => [
    r.sku, r.name, r.variant, r.category ?? '', r.stock, threshold, STATUS_LABEL[stockStatus(r.stock, threshold)],
    ...(withCost ? [r.cost ?? '', r.cost === null ? '' : Math.max(0, r.stock) * r.cost] : []),
  ].map(cell).join(','));
  return '﻿' + [head.join(','), ...lines].join('\r\n');
}

export type MovementKind = 'all' | 'in' | 'out' | 'adjust';
/** Which movement reasons each history tab shows. */
export const MOVEMENT_REASONS: Record<Exclude<MovementKind, 'all'>, string[]> = {
  in: ['restock', 'return', 'cancel'],
  out: ['order'],
  adjust: ['adjust', 'edit'],
};

/** A stock-in order's lines → units and cost. */
export function stockOrderTotals(items: { quantity: number; unit_cost: number | null }[]): { lines: number; units: number; cost: number } {
  return items.reduce((t, i) => ({ lines: t.lines + 1, units: t.units + i.quantity, cost: t.cost + (i.unit_cost ?? 0) * i.quantity }), { lines: 0, units: 0, cost: 0 });
}
