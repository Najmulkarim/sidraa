/** Clothing sizes in shop order; unknown sizes go last. Safe for client components. */
const SIZE_ORDER = ['xxs', 'xs', 's', 'm', 'l', 'xl', 'xxl', '2xl', '3xl', '4xl', 'free size'];

export function sizeRank(size: string): number {
  const s = size.trim().toLowerCase();
  const i = SIZE_ORDER.indexOf(s);
  if (i !== -1) return i;
  const n = Number(s.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && /\d/.test(s) ? 100 + n : 1000;
}
