/** "Navy / XL / Half sleeve" — same order as public.variant_label(). Safe anywhere. */
export function variantLabel(v: { color: string; size: string; option3?: string | null }): string {
  return [v.color, v.size, v.option3 ?? ''].filter(Boolean).join(' / ');
}

/** What the shopper is told about availability. Taking orders is what counts, not the stock number. */
export function availability(mode: 'sold_out' | 'preorder' | 'continue', units: number, days: number | null): { state: 'in_stock' | 'preorder' | 'out'; text: string } {
  if (units > 0 || mode === 'continue') return { state: 'in_stock', text: 'In stock' };
  if (mode === 'preorder') {
    const n = days ?? 7;
    return { state: 'preorder', text: `Pre-order · delivery in ${n} day${n === 1 ? '' : 's'}` };
  }
  return { state: 'out', text: 'Out of stock' };
}
