/**
 * The advanced report: everything about the orders placed in a period — what
 * became of them, which products, places, sources, staff and couriers did well,
 * and when customers order. Pure functions over plain rows (tested), so the
 * page only loads data and draws it.
 */

import { deliveredQuantities } from './delivered-items';

export type ReportItem = { product_id: string | null; product_name: string; quantity: number; unit_price?: number | string | null; line_total: number | string; unit_cost: number | string | null };

export type ReportOrder = {
  id: string;
  status: string;
  total: number | string;
  created_at: string;
  confirmed_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  courier_sent_at: string | null;
  source: string;
  landing_slug: string | null;
  coupon_code: string | null;
  district: string | null;
  courier: string | null;
  courier_consignment_id: string | null;
  assigned_to: string | null;
  customer_phone: string;
  /** For partial deliveries and exchanges: only the pieces that reached the customer count as sold. */
  paid_amount?: number | string | null;
  delivery_charge?: number | string | null;
  discount?: number | string | null;
  courier_outcome?: string | null;
  items: ReportItem[];
};

export type Outcome = 'delivered' | 'returned' | 'cancelled' | 'active';
export const OUTCOMES: { key: Outcome; label: string }[] = [
  { key: 'delivered', label: 'Delivered' },
  { key: 'active', label: 'In progress' },
  { key: 'returned', label: 'Returned' },
  { key: 'cancelled', label: 'Cancelled' },
];

/** What became of an order: delivered, came back (returned or lost), cancelled (incl. fake), or still on its way. */
export function outcomeOf(status: string): Outcome {
  if (status === 'delivered') return 'delivered';
  if (status === 'returned' || status === 'lost') return 'returned';
  if (status === 'cancelled' || status === 'fake') return 'cancelled';
  return 'active';
}

const n = (v: number | string | null | undefined) => (v === null || v === undefined || v === '' ? 0 : Number(v));
const r2 = (x: number) => Math.round(x * 100) / 100;
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);

/** Dhaka (UTC+6, no daylight saving) calendar day, weekday (0 = Sunday) and hour. */
export function dhakaParts(iso: string) {
  const d = new Date(new Date(iso).getTime() + 6 * 3600_000);
  return { day: d.toISOString().slice(0, 10), weekday: d.getUTCDay(), hour: d.getUTCHours() };
}

type Count = { orders: number; value: number; delivered: number; returned: number; cancelled: number; active: number };
const emptyCount = (): Count => ({ orders: 0, value: 0, delivered: 0, returned: 0, cancelled: 0, active: 0 });
const addTo = (c: Count, o: ReportOrder, out: Outcome) => { c.orders++; c.value += n(o.total); c[out]++; };
/** Delivered out of the orders that finished their journey (delivered or came back). */
export const successRate = (c: Pick<Count, 'delivered' | 'returned'>) => pct(c.delivered, c.delivered + c.returned);

export type ProductRow = {
  key: string; name: string; category: string; orders: number; units: number; value: number;
  deliveredUnits: number; returnedUnits: number; revenue: number; cost: number; missingCost: number; profit: number;
  margin: number | null; returnRate: number | null; stock: number | null;
};

export type Report = ReturnType<typeof buildReport>;

export function buildReport(
  orders: ReportOrder[],
  opts: {
    days: string[];
    /** product_id → category name and stock left */
    products?: Map<string, { category: string | null; stock: number | null }>;
    /** phones that had ordered before this period */
    returningPhones?: Set<string>;
    staffNames?: Map<string, string>;
  },
) {
  const total = emptyCount();
  const byDay = new Map(opts.days.map((d) => [d, emptyCount()]));
  const heat = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  const products = new Map<string, ProductRow>();
  const districts = new Map<string, Count>();
  const staff = new Map<string, Count>();
  const couriers = new Map<string, Count & { sent: number; daysToDeliver: number[] }>();
  const sources = { website: emptyCount(), landing: emptyCount(), manual: emptyCount(), coupon: emptyCount() };
  const phones = new Map<string, number>();
  let confirmed = 0, shipped = 0;
  let deliveredRevenue = 0, deliveredCost = 0, missingCostUnits = 0;

  for (const o of orders) {
    const out = outcomeOf(o.status);
    addTo(total, o, out);
    const { day, weekday, hour } = dhakaParts(o.created_at);
    const dc = byDay.get(day);
    if (dc) addTo(dc, o, out);
    heat[weekday]![hour]!++;
    phones.set(o.customer_phone, (phones.get(o.customer_phone) ?? 0) + 1);

    // Funnel: confirmed (by staff, or later steps), handed to a courier, delivered.
    if (o.confirmed_at || o.shipped_at || o.courier_sent_at || out === 'delivered' || out === 'returned') confirmed++;
    if (o.shipped_at || o.courier_sent_at || out === 'delivered' || out === 'returned') shipped++;

    const dk = (o.district ?? '').trim() || 'Unknown';
    if (!districts.has(dk)) districts.set(dk, emptyCount());
    addTo(districts.get(dk)!, o, out);

    const sk = o.assigned_to ?? '';
    if (!staff.has(sk)) staff.set(sk, emptyCount());
    addTo(staff.get(sk)!, o, out);

    if (o.courier && o.courier_consignment_id) {
      if (!couriers.has(o.courier)) couriers.set(o.courier, { ...emptyCount(), sent: 0, daysToDeliver: [] });
      const c = couriers.get(o.courier)!;
      addTo(c, o, out);
      c.sent++;
      if (out === 'delivered' && o.delivered_at && o.courier_sent_at) {
        c.daysToDeliver.push((new Date(o.delivered_at).getTime() - new Date(o.courier_sent_at).getTime()) / 86_400_000);
      }
    }

    if (o.source !== 'website') addTo(sources.manual, o, out);
    else if (o.landing_slug) addTo(sources.landing, o, out);
    else addTo(sources.website, o, out);
    if (o.coupon_code) addTo(sources.coupon, o, out);

    const seen = new Set<string>();
    const sold = deliveredQuantities(o, o.items);
    for (const [k, i] of o.items.entries()) {
      const key = i.product_id ?? `name:${i.product_name}`;
      const meta = i.product_id ? opts.products?.get(i.product_id) : undefined;
      if (!products.has(key)) {
        products.set(key, { key, name: i.product_name, category: meta?.category ?? 'Uncategorised', orders: 0, units: 0, value: 0, deliveredUnits: 0, returnedUnits: 0, revenue: 0, cost: 0, missingCost: 0, profit: 0, margin: null, returnRate: null, stock: meta?.stock ?? null });
      }
      const p = products.get(key)!;
      if (!seen.has(key)) { p.orders++; seen.add(key); }
      p.units += i.quantity;
      p.value += n(i.line_total);
      if (out === 'delivered') {
        const q = sold[k]!;
        const revenue = i.quantity > 0 ? (n(i.line_total) * q) / i.quantity : 0;
        p.deliveredUnits += q;
        p.revenue += revenue;
        deliveredRevenue += revenue;
        if (i.unit_cost === null || i.unit_cost === undefined || i.unit_cost === '') { p.missingCost += q; missingCostUnits += q; }
        else { p.cost += q * n(i.unit_cost); deliveredCost += q * n(i.unit_cost); }
      } else if (out === 'returned') p.returnedUnits += i.quantity;
    }
  }

  const productRows = [...products.values()].map((p) => {
    const profit = r2(p.revenue - p.cost);
    return { ...p, value: r2(p.value), revenue: r2(p.revenue), cost: r2(p.cost), profit, margin: pct(profit, p.revenue), returnRate: pct(p.returnedUnits, p.deliveredUnits + p.returnedUnits) };
  }).sort((a, b) => b.value - a.value);

  const categories = new Map<string, { name: string; orders: number; units: number; value: number; revenue: number; profit: number; returnedUnits: number; deliveredUnits: number }>();
  for (const p of productRows) {
    if (!categories.has(p.category)) categories.set(p.category, { name: p.category, orders: 0, units: 0, value: 0, revenue: 0, profit: 0, returnedUnits: 0, deliveredUnits: 0 });
    const c = categories.get(p.category)!;
    c.orders += p.orders; c.units += p.units; c.value += p.value; c.revenue += p.revenue; c.profit += p.profit;
    c.returnedUnits += p.returnedUnits; c.deliveredUnits += p.deliveredUnits;
  }

  // Returning = had ordered before this period, or ordered more than once in it.
  const newCustomers = opts.returningPhones ? [...phones].filter(([ph, count]) => count === 1 && !opts.returningPhones!.has(ph)).length : null;
  const grossProfit = r2(deliveredRevenue - deliveredCost);

  return {
    summary: {
      orders: total.orders,
      value: r2(total.value),
      aov: total.orders ? r2(total.value / total.orders) : 0,
      delivered: total.delivered,
      returned: total.returned,
      cancelled: total.cancelled,
      active: total.active,
      successRate: successRate(total),
      returnRate: pct(total.returned, total.delivered + total.returned),
      cancelRate: pct(total.cancelled, total.orders),
      productRevenue: r2(deliveredRevenue),
      grossProfit,
      grossMargin: pct(grossProfit, deliveredRevenue),
      missingCostUnits,
      customers: phones.size,
      newCustomers,
      returningCustomers: newCustomers === null ? null : phones.size - newCustomers,
    },
    daily: opts.days.map((day) => ({ day, ...(byDay.get(day) ?? emptyCount()) })),
    funnel: [
      { label: 'Orders placed', count: total.orders },
      { label: 'Confirmed', count: confirmed },
      { label: 'Handed to courier', count: shipped },
      { label: 'Delivered', count: total.delivered },
    ],
    heat,
    products: productRows,
    categories: [...categories.values()].map((c) => ({ ...c, value: r2(c.value), revenue: r2(c.revenue), profit: r2(c.profit), returnRate: pct(c.returnedUnits, c.deliveredUnits + c.returnedUnits) })).sort((a, b) => b.value - a.value),
    districts: [...districts.entries()].map(([name, c]) => ({ name, ...c, value: r2(c.value), successRate: successRate(c) })).sort((a, b) => b.orders - a.orders),
    sources: (['website', 'landing', 'manual', 'coupon'] as const).map((k) => ({ key: k, ...sources[k], value: r2(sources[k].value), successRate: successRate(sources[k]) })),
    staff: [...staff.entries()].map(([id, c]) => ({ id, name: id ? opts.staffNames?.get(id) ?? 'Former staff' : 'Unassigned', ...c, value: r2(c.value), successRate: successRate(c), cancelRate: pct(c.cancelled, c.orders) })).sort((a, b) => b.orders - a.orders),
    couriers: [...couriers.entries()].map(([name, c]) => ({
      name, sent: c.sent, delivered: c.delivered, returned: c.returned, active: c.active, successRate: successRate(c),
      avgDays: c.daysToDeliver.length ? Math.round((c.daysToDeliver.reduce((a, b) => a + b, 0) / c.daysToDeliver.length) * 10) / 10 : null,
    })).sort((a, b) => b.sent - a.sent),
  };
}

/** Change from the previous period, in percent (null when there is nothing to compare with). */
export function change(now: number, before: number): number | null {
  if (!before) return now ? null : 0;
  return Math.round(((now - before) / before) * 1000) / 10;
}
