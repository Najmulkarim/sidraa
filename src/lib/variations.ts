/**
 * Variations: up to three types per product — colour, size and one more
 * the shop names itself (e.g. "Sleeve"). Every combination is one row in
 * product_variants with its own SKU, price, stock and optional photo.
 * Pure helpers for the size/colour pickers and the admin generator —
 * unit tested in tests/unit/variations.test.ts.
 */
import { sizeRank } from './sizes';

export type OptionKey = 'color' | 'size' | 'option3';
export const OPTION_KEYS: OptionKey[] = ['color', 'size', 'option3'];

export type PickVariant = {
  id: string;
  color: string;
  size: string;
  option3: string;
  image_path: string | null;
  stock: number;
  price: number;
  /** Shown on the product page for the chosen variation. */
  sku?: string;
};

export type OptionValue = { value: string; image: string | null };
export type OptionGroup = { key: OptionKey; label: string; values: OptionValue[] };
export type Selection = Partial<Record<OptionKey, string>>;

export type OptionLabels = { color_label?: string | null; size_label?: string | null; option3_label?: string | null };

export function labelsOf(p: OptionLabels): Record<OptionKey, string> {
  return { color: p.color_label || 'Color', size: p.size_label || 'Size', option3: p.option3_label || 'Option' };
}

/**
 * The picker groups for a product: only types that have a value.
 * Colours follow the photo order (reorder photos to reorder colours),
 * sizes follow S < M < L < XL, the third option keeps its first-seen order.
 */
export function optionGroups(variants: PickVariant[], labels: OptionLabels, imageOrder: string[] = []): OptionGroup[] {
  const names = labelsOf(labels);
  return OPTION_KEYS.flatMap((key) => {
    const seen = new Map<string, OptionValue>();
    for (const v of variants) {
      const value = v[key];
      if (!value) continue;
      const cur = seen.get(value);
      if (!cur) seen.set(value, { value, image: key === 'color' ? v.image_path : null });
      else if (key === 'color' && !cur.image && v.image_path) cur.image = v.image_path;
    }
    if (seen.size === 0) return [];
    let values = [...seen.values()];
    if (key === 'size') values = values.sort((a, b) => sizeRank(a.value) - sizeRank(b.value));
    if (key === 'color') {
      const rank = (o: OptionValue) => (o.image && imageOrder.includes(o.image) ? imageOrder.indexOf(o.image) : 1000);
      values = values.map((o, i) => ({ o, i })).sort((a, b) => rank(a.o) - rank(b.o) || a.i - b.i).map((x) => x.o);
    }
    return [{ key, label: names[key], values }];
  });
}

const matches = (v: PickVariant, sel: Selection) => OPTION_KEYS.every((k) => sel[k] === undefined || v[k] === sel[k]);

/** The variant for a complete selection (every group picked), else null. */
export function findVariant(variants: PickVariant[], groups: OptionGroup[], sel: Selection): PickVariant | null {
  if (!groups.every((g) => sel[g.key] !== undefined)) return null;
  return variants.find((v) => OPTION_KEYS.every((k) => (groups.some((g) => g.key === k) ? v[k] === sel[k] : v[k] === ''))) ?? null;
}

/**
 * Whether picking `value` for `key` can still lead to something in stock,
 * given the other choices already made.
 */
export function canPick(variants: PickVariant[], sel: Selection, key: OptionKey, value: string): boolean {
  const next = { ...sel, [key]: value };
  return variants.some((v) => v.stock > 0 && matches(v, next));
}

/** Whether a value exists at all with the other choices (false → hide/strike). */
export function exists(variants: PickVariant[], sel: Selection, key: OptionKey, value: string): boolean {
  const next = { ...sel, [key]: value };
  return variants.some((v) => matches(v, next));
}

/** First choice to show: the first in-stock variant, so the page opens on something buyable. */
export function initialSelection(variants: PickVariant[], groups: OptionGroup[]): Selection {
  const first = variants.find((v) => v.stock > 0) ?? variants[0];
  if (!first) return {};
  // Pre-select only the colour (it changes the photo); sizes are a conscious choice.
  const colorGroup = groups.find((g) => g.key === 'color');
  if (groups.length === 1 && groups[0]!.values.length === 1) return { [groups[0]!.key]: groups[0]!.values[0]!.value };
  return colorGroup ? { color: first.color } : {};
}

/** Every combination of the given values, for the admin "Create combinations" button. */
export function combinations(colors: string[], sizes: string[], options: string[]): { color: string; size: string; option3: string }[] {
  const clean = (xs: string[]) => {
    const out: string[] = [];
    for (const x of xs.map((s) => s.trim()).filter(Boolean)) if (!out.some((o) => o.toLowerCase() === x.toLowerCase())) out.push(x);
    return out.length ? out : [''];
  };
  const out: { color: string; size: string; option3: string }[] = [];
  for (const color of clean(colors)) for (const size of clean(sizes)) for (const option3 of clean(options)) out.push({ color, size, option3 });
  return out;
}

/** SKU suggestion: BASE-NAV-XL-H. Upper case, letters and digits only. */
export function suggestSku(base: string, c: { color: string; size: string; option3: string }): string {
  const part = (s: string, n: number) => s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, n);
  return [part(base, 8) || 'SKU', part(c.color, 3), part(c.size, 6), part(c.option3, 1)].filter(Boolean).join('-');
}

/** Splits "Red, Blue; Green" into values. */
export function splitValues(input: string): string[] {
  return input.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
}
