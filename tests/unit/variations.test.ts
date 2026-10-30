import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { variantLabel } from '@/lib/catalog-labels';
import { canPick, combinations, exists, findVariant, initialSelection, optionGroups, splitValues, suggestSku, type PickVariant } from '@/lib/variations';
import { productSchema } from '@/lib/validation';

let n = 0;
const v = (color: string, size: string, option3 = '', stock = 5, image_path: string | null = null): PickVariant => ({ id: `v${++n}`, color, size, option3, stock, image_path, price: 1000 });

const shirt = [
  v('Navy', 'M', 'Full', 5, '/n.svg'), v('Navy', 'L', 'Full', 0, '/n.svg'), v('Navy', 'M', 'Half', 2, '/n.svg'),
  v('White', 'XL', 'Full', 3, '/w.svg'), v('White', 'M', 'Full', 0, '/w.svg'), v('Maroon', 'L', 'Half', 0, '/m.svg'),
];

describe('variations', () => {
  it('builds one picker per type, in the right order', () => {
    const g = optionGroups(shirt, { color_label: 'Colour', size_label: 'Size', option3_label: 'Sleeve' }, ['/w.svg', '/n.svg', '/m.svg']);
    expect(g.map((x) => x.label)).toEqual(['Colour', 'Size', 'Sleeve']);
    expect(g[0]!.values.map((x) => x.value)).toEqual(['White', 'Navy', 'Maroon']); // photo order
    expect(g[0]!.values[0]!.image).toBe('/w.svg');
    expect(g[1]!.values.map((x) => x.value)).toEqual(['M', 'L', 'XL']); // size order
  });
  it('skips types nobody uses', () => {
    expect(optionGroups([v('', 'S'), v('', 'M')], {}).map((x) => x.key)).toEqual(['size']);
    expect(optionGroups([v('', '')], {})).toEqual([]);
  });
  it('finds the variant only when every type is picked', () => {
    const g = optionGroups(shirt, {});
    expect(findVariant(shirt, g, { color: 'Navy', size: 'M' })).toBeNull();
    expect(findVariant(shirt, g, { color: 'Navy', size: 'M', option3: 'Half' })?.stock).toBe(2);
  });
  it('knows what can still be bought with the current choice', () => {
    expect(canPick(shirt, { color: 'Navy' }, 'size', 'L')).toBe(false); // exists but sold out
    expect(exists(shirt, { color: 'Navy' }, 'size', 'L')).toBe(true);
    expect(exists(shirt, { color: 'Navy' }, 'size', 'XL')).toBe(false);
    expect(canPick(shirt, { color: 'White' }, 'size', 'XL')).toBe(true);
  });
  it('opens on an in-stock colour', () => {
    expect(initialSelection(shirt, optionGroups(shirt, {}))).toEqual({ color: 'Navy' });
    const one = [v('', 'Free size')];
    expect(initialSelection(one, optionGroups(one, {}))).toEqual({ size: 'Free size' });
  });
  it('creates every combination once', () => {
    const c = combinations(splitValues('Red, Blue, red'), splitValues('S; M'), []);
    expect(c).toHaveLength(4);
    expect(c[0]).toEqual({ color: 'Red', size: 'S', option3: '' });
    expect(combinations([], [], [])).toEqual([{ color: '', size: '', option3: '' }]);
    expect(suggestSku('MCOS', { color: 'Navy Blue', size: 'XL', option3: 'Half sleeve' })).toBe('MCOS-NAV-XL-H');
  });
  it('labels a variation colour first', () => {
    expect(variantLabel({ color: 'Navy', size: 'XL', option3: 'Half sleeve' })).toBe('Navy / XL / Half sleeve');
    expect(variantLabel({ color: '', size: 'M' })).toBe('M');
  });
  it('the product form refuses duplicate combinations and an unnamed third type', () => {
    const base = { name: 'Shirt', slug: 'shirt', basePrice: '1000', status: 'draft' };
    const twice = JSON.stringify([{ sku: 'A', color: 'Red', size: 'M' }, { sku: 'B', color: 'red', size: 'm' }]);
    expect(productSchema.safeParse({ ...base, variants: twice }).success).toBe(false);
    const unnamed = JSON.stringify([{ sku: 'A', color: 'Red', size: 'M', option3: 'Half' }]);
    expect(productSchema.safeParse({ ...base, variants: unnamed }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, option3Label: 'Sleeve', variants: unnamed }).success).toBe(true);
  });
  it('photos uploaded before the first save must be product photo paths', () => {
    const base = { name: 'Shirt', slug: 'shirt', basePrice: '1000', status: 'draft', variants: JSON.stringify([{ sku: 'A' }]) };
    const id = '00000000-0000-4000-8000-000000000001';
    const ok = JSON.stringify([{ path: `products/${id}/00000000-0000-4000-8000-000000000002.jpg`, alt: 'Front' }]);
    expect(productSchema.safeParse({ ...base, newId: id, photos: ok }).success).toBe(true);
    expect(productSchema.safeParse({ ...base, newId: id, photos: JSON.stringify([{ path: '../../etc/passwd' }]) }).success).toBe(false);
    const r = productSchema.safeParse(base);
    expect(r.success && r.data.photos).toEqual([]);
  });
});

describe('variations dragged into order', () => {
  const rows = [v('Red', 'XL'), v('Blue', 'S')];
  it('keeps row order when the admin arranged the rows', () => {
    const g = optionGroups(rows, {}, [], true);
    expect(g[0]?.values.map((o) => o.value)).toEqual(['Red', 'Blue']);
    expect(g[1]?.values.map((o) => o.value)).toEqual(['XL', 'S']);
  });
  it('stays automatic otherwise', () => {
    expect(optionGroups(rows, {})[1]?.values.map((o) => o.value)).toEqual(['S', 'XL']);
  });
});

describe('saving variations', () => {
  it('every column the admin form updates may be updated by staff', () => {
    const dir = join(process.cwd(), 'supabase', 'migrations');
    const sql = readdirSync(dir).map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
    const granted = [...sql.matchAll(/grant update \(([^)]*)\) on public\.product_variants/g)].flatMap((m) => (m[1] ?? '').split(',').map((c) => c.trim()));
    const action = readFileSync(join(process.cwd(), 'src', 'actions', 'admin-catalog.ts'), 'utf8');
    const fields = /const fields = \{([^\n]*)\};/.exec(action)?.[1] ?? '';
    const columns = [...fields.matchAll(/([a-z_0-9]+):/g)].map((m) => m[1] ?? '').filter((c) => c !== 'v');
    expect(columns.length).toBeGreaterThan(5);
    expect(columns.filter((c) => !granted.includes(c))).toEqual([]);
  });
});
