/**
 * Which pieces of an order really reached the customer. Mirrors
 * public.delivered_items() (migration 0079), so Accounting's per-order list
 * and the reports count the same product cost as the profit & loss.
 *
 * - Normal order: every piece.
 * - Exchange (the courier swapped it for something the customer had already
 *   bought): none. That product was counted with the earlier order.
 * - Partial delivery: the pieces the collected cash paid for. The most
 *   expensive pieces are matched first: cash less delivery charge (plus any
 *   discount) covers a piece if what is left still pays its full price.
 */

export type CourierOutcome = 'partial' | 'exchange';

export type OutcomeOrder = {
  courier_outcome?: string | null;
  total?: number | string | null;
  paid_amount?: number | string | null;
  delivery_charge?: number | string | null;
  discount?: number | string | null;
};

export type PricedItem = { quantity: number; unit_price?: number | string | null; line_total?: number | string | null };

const num = (v: number | string | null | undefined) => (v === null || v === undefined || v === '' ? 0 : Number(v));

const priceOf = (i: PricedItem) =>
  i.unit_price !== null && i.unit_price !== undefined && i.unit_price !== '' ? num(i.unit_price) : i.quantity > 0 ? num(i.line_total) / i.quantity : 0;

/** For each line (same order as given), how many pieces were delivered. */
export function deliveredQuantities(o: OutcomeOrder, items: PricedItem[]): number[] {
  if (o.courier_outcome === 'exchange') return items.map(() => 0);
  if (o.courier_outcome !== 'partial') return items.map((i) => i.quantity);
  const got = Math.min(num(o.paid_amount), num(o.total) || Infinity);
  // One taka of slack for rounding.
  let left = got - num(o.delivery_charge) + num(o.discount) + 1;
  const out = items.map(() => 0);
  const order = items.map((_, k) => k).sort((a, b) => priceOf(items[b]!) - priceOf(items[a]!) || a - b);
  for (const k of order) {
    const it = items[k]!;
    const price = priceOf(it);
    const n = price > 0 ? Math.max(0, Math.min(it.quantity, Math.floor(left / price))) : it.quantity;
    out[k] = n;
    left -= n * price;
  }
  return out;
}
