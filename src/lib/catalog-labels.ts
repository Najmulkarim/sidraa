/** "Navy / XL / Half sleeve" — same order as public.variant_label(). Safe anywhere. */
export function variantLabel(v: { color: string; size: string; option3?: string | null }): string {
  return [v.color, v.size, v.option3 ?? ''].filter(Boolean).join(' / ');
}
