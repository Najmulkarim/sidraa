/**
 * Preview arithmetic for the admin order editor. The database
 * (admin_save_order) recalculates everything on save; this only keeps the
 * numbers on screen honest while staff type. Pure — unit tested.
 */
export type EditorLine = { variantId: string; quantity: number; unitPrice: number };
export type EditorZone = { id: string; charge: number | string; free_over: number | string | null };

const num = (v: number | string | null | undefined) => (v === null || v === undefined || v === '' ? 0 : Number(v));

export function zoneCharge(zone: EditorZone | undefined, goods: number): number {
  if (!zone) return 0;
  const free = zone.free_over === null ? null : num(zone.free_over);
  return free !== null && goods >= free ? 0 : num(zone.charge);
}

export function editorTotals(lines: EditorLine[], discount: number, zone: EditorZone | undefined, deliveryOverride: number | null) {
  const subtotal = round2(lines.reduce((s, l) => s + (Number.isFinite(l.unitPrice) ? l.unitPrice : 0) * (Number.isFinite(l.quantity) ? l.quantity : 0), 0));
  const d = Math.min(Math.max(0, Number.isFinite(discount) ? discount : 0), subtotal);
  const delivery = deliveryOverride !== null && Number.isFinite(deliveryOverride) ? Math.max(0, deliveryOverride) : zoneCharge(zone, subtotal - d);
  return { subtotal, discount: d, delivery, total: round2(subtotal - d + delivery) };
}

/** Adds a size to the lines, or bumps the quantity if it is already there. */
export function addLine(lines: EditorLine[], variantId: string, price: number): EditorLine[] {
  const i = lines.findIndex((l) => l.variantId === variantId);
  if (i === -1) return [...lines, { variantId, quantity: 1, unitPrice: price }];
  return lines.map((l, j) => (j === i ? { ...l, quantity: Math.min(99, l.quantity + 1) } : l));
}

/**
 * Units of a size still available to this order: free stock plus what the
 * order already holds (those come back if the line is reduced).
 */
export function availableFor(variantId: string, freeStock: number, original: { variant_id: string | null; quantity: number }[]): number {
  return freeStock + original.filter((o) => o.variant_id === variantId).reduce((s, o) => s + o.quantity, 0);
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
