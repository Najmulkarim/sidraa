/** The courier tab in Accounting: parcels grouped the way the courier's own dashboard shows them. */

export type InsightKey = 'delivered' | 'active' | 'hold' | 'regular_return' | 'paid_return' | 'partial' | 'exchange' | 'others';

export const INSIGHT_GROUPS: { key: InsightKey; label: string; color: string; hint: string }[] = [
  { key: 'delivered', label: 'Delivered', color: '#0f8a5f', hint: 'Cash collected' },
  { key: 'active', label: 'Active deliveries', color: '#5fb98f', hint: 'Still to collect' },
  { key: 'hold', label: 'On hold', color: '#f08c00', hint: 'Still to collect' },
  { key: 'regular_return', label: 'Regular return', color: '#d6334a', hint: 'Nothing collected' },
  { key: 'paid_return', label: 'Paid return', color: '#ef7a86', hint: 'Customer paid at the door' },
  { key: 'partial', label: 'Partial delivery', color: '#f4a6ae', hint: 'Cash collected' },
  { key: 'exchange', label: 'Exchange', color: '#c9a3d9', hint: 'Cash collected' },
  { key: 'others', label: 'Others', color: '#1c8ad6', hint: '' },
];

/** Groups whose parcel journey is over: the courier charges for these. */
const FINISHED: InsightKey[] = ['delivered', 'regular_return', 'paid_return', 'partial', 'exchange'];

/** The courier's COD fee when it does not report one: about 1% of the cash collected. */
export const COD_FEE_RATE = 0.01;

export type InsightOrder = {
  id: string;
  public_ref: string;
  status: string;
  courier_status: string | null;
  courier_charge: number | string | null;
  courier_collected: number | string | null;
  courier_cod_fee: number | string | null;
  total: number | string;
  paid_amount: number | string;
  paid_before_delivery: number | string | null;
};

const num = (v: number | string | null | undefined) => (v === null || v === undefined || v === '' ? null : Number(v));
const slug = (s: string | null) => (s ?? '').toLowerCase().replace(/[^a-z]+/g, '_').replace(/^order_|_$/g, '');

/** Which group a parcel is in, from the courier's own word first, then the order's status. Null = not counted (pickup cancelled). */
export function insightGroup(o: Pick<InsightOrder, 'status' | 'courier_status'>): InsightKey | null {
  const s = slug(o.courier_status);
  if (/pickup_cancel/.test(s)) return null;
  if (/paid_return/.test(s)) return 'paid_return';
  if (/partial/.test(s)) return 'partial';
  if (/exchange/.test(s)) return 'exchange';
  if (/^delivered/.test(s)) return 'delivered';
  if (/return|cancel/.test(s)) return 'regular_return';
  if (/hold/.test(s)) return 'hold';
  switch (o.status) {
    case 'delivered': return 'delivered';
    case 'returned': return 'regular_return';
    case 'hold': return 'hold';
    case 'shipped': return 'active';
    case 'cancelled': return null;
    default: return o.courier_status ? 'active' : 'others';
  }
}

export type InsightRow = InsightOrder & {
  group: InsightKey;
  /** Cash the courier took from the customer (finished parcels). */
  collected: number;
  /** Cash still to collect (parcels on the road or on hold). */
  toCollect: number;
  fee: number;
  codFee: number;
  codFeeEstimated: boolean;
};

export function insightRow(o: InsightOrder, group: InsightKey): InsightRow {
  const total = num(o.total) ?? 0;
  const paid = num(o.paid_amount) ?? 0;
  const reported = num(o.courier_collected);
  let collected = 0;
  // Delivered: Paid on the order (staff lower it when the customer paid less at the door), less any advance paid before.
  if (group === 'delivered') collected = reported ?? Math.max(0, Math.min(paid, total) - (num(o.paid_before_delivery) ?? 0));
  else if (group === 'paid_return' || group === 'partial' || group === 'exchange') collected = reported ?? paid;
  const finished = FINISHED.includes(group);
  const reportedCod = num(o.courier_cod_fee);
  const codFee = !finished ? 0 : reportedCod ?? Math.round(collected * COD_FEE_RATE * 100) / 100;
  return {
    ...o,
    group,
    collected,
    toCollect: group === 'active' || group === 'hold' ? Math.max(0, total - paid) : 0,
    fee: finished ? num(o.courier_charge) ?? 0 : 0,
    codFee,
    codFeeEstimated: finished && reportedCod === null && collected > 0,
  };
}

export type Insight = {
  rows: InsightRow[];
  groups: { key: InsightKey; label: string; color: string; hint: string; count: number; amount: number; pct: number }[];
  count: number;
  amount: number;
  pickupCancelled: number;
  collected: number;
  fees: number;
  codFees: number;
  codFeeEstimated: number;
  missingFee: number;
  payout: number;
  toCollect: number;
};

export function courierInsight(orders: InsightOrder[]): Insight {
  const rows: InsightRow[] = [];
  let pickupCancelled = 0;
  for (const o of orders) {
    const g = insightGroup(o);
    if (g === null) pickupCancelled++;
    else rows.push(insightRow(o, g));
  }
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const sum = (f: (r: InsightRow) => number, xs = rows) => r2(xs.reduce((a, r) => a + f(r), 0));
  const count = rows.length;
  const groups = INSIGHT_GROUPS.map((g) => {
    const xs = rows.filter((r) => r.group === g.key);
    return { ...g, count: xs.length, amount: sum((r) => r.collected + r.toCollect, xs), pct: count ? Math.round((xs.length / count) * 100) : 0 };
  });
  const collected = sum((r) => r.collected);
  const fees = sum((r) => r.fee);
  const codFees = sum((r) => r.codFee);
  return {
    rows,
    groups,
    count,
    amount: sum((r) => r.collected + r.toCollect),
    pickupCancelled,
    collected,
    fees,
    codFees,
    codFeeEstimated: rows.filter((r) => r.codFeeEstimated).length,
    missingFee: rows.filter((r) => FINISHED.includes(r.group) && num(r.courier_charge) === null).length,
    payout: r2(collected - fees - codFees),
    toCollect: sum((r) => r.toCollect),
  };
}
