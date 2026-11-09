import { describe, expect, it } from 'vitest';
import { courierInsight, insightGroup, type InsightKey, type InsightOrder } from '@/lib/courier-insight';

const o = (p: Partial<InsightOrder>): InsightOrder => ({
  id: p.public_ref ?? 'x', public_ref: 'x', status: 'shipped', courier_status: null, courier_charge: 60,
  courier_collected: null, courier_cod_fee: null, total: 1000, paid_amount: 0, paid_before_delivery: null, ...p,
});

describe('courier insight', () => {
  it('groups by the courier word first', () => {
    expect(insightGroup({ status: 'returned', courier_status: 'paid_return' })).toBe('paid_return');
    expect(insightGroup({ status: 'returned', courier_status: 'Return' })).toBe('regular_return');
    expect(insightGroup({ status: 'delivered', courier_status: 'Delivered' })).toBe('delivered');
    expect(insightGroup({ status: 'delivered', courier_status: 'partial_delivered' })).toBe('partial');
    expect(insightGroup({ status: 'cancelled', courier_status: 'Pickup_Cancelled' })).toBeNull();
    expect(insightGroup({ status: 'shipped', courier_status: 'In_Transit' })).toBe('active');
    expect(insightGroup({ status: 'hold', courier_status: 'On_Hold' })).toBe('hold');
    expect(insightGroup({ status: 'returned', courier_status: 'order.paid-return' })).toBe('paid_return');
  });

  it('matches the Pathao dashboard on real numbers', () => {
    const r = courierInsight([
      o({ public_ref: 'SD0012', status: 'returned', courier_status: 'paid_return', total: 760, paid_amount: 60 }),
      o({ public_ref: 'SD0011', status: 'delivered', courier_status: 'Delivered', total: 2060, paid_amount: 2060, paid_before_delivery: 0 }),
      o({ public_ref: 'SD0008', status: 'delivered', courier_status: 'Delivered', total: 4140, paid_amount: 4140 }),
      o({ public_ref: 'SD0007', status: 'delivered', courier_status: 'Delivered', total: 620, paid_amount: 620 }),
      o({ public_ref: 'SD0006', status: 'delivered', courier_status: 'Delivered', total: 770, paid_amount: 770 }),
      o({ public_ref: 'SD0005', status: 'cancelled', courier_status: 'Pickup_Cancelled', total: 420 }),
    ]);
    expect(r.count).toBe(5);
    expect(r.amount).toBe(7650);
    expect(r.pickupCancelled).toBe(1);
    const g = Object.fromEntries(r.groups.map((x) => [x.key, x])) as Record<InsightKey, (typeof r.groups)[number]>;
    expect([g.delivered.count, g.delivered.amount, g.delivered.pct]).toEqual([4, 7590, 80]);
    expect([g.paid_return.count, g.paid_return.amount, g.paid_return.pct]).toEqual([1, 60, 20]);
    expect(r.fees).toBe(300);
    expect(r.codFees).toBe(76.5);
    expect(r.payout).toBe(7273.5);
  });

  it('counts what the customer really paid at the door', () => {
    const r = courierInsight([o({ status: 'delivered', courier_status: 'Delivered', total: 1000, paid_amount: 950, paid_before_delivery: 0 })]);
    expect(r.collected).toBe(950);
    expect(r.groups.find((g) => g.key === 'delivered')?.amount).toBe(950);
  });

  it('uses the money the courier reported, and an advance is not collected', () => {
    const r = courierInsight([
      o({ status: 'delivered', courier_status: 'Delivered', total: 1000, paid_amount: 1000, paid_before_delivery: 200 }),
      o({ status: 'delivered', courier_status: 'Delivered', total: 500, courier_collected: 450, courier_cod_fee: 5 }),
      o({ status: 'shipped', courier_status: 'In_Transit', total: 900, paid_amount: 100, courier_charge: null }),
    ]);
    expect(r.collected).toBe(1250);
    expect(r.codFees).toBe(13);
    expect(r.codFeeEstimated).toBe(1);
    expect(r.toCollect).toBe(800);
    expect(r.fees).toBe(120);
    expect(r.missingFee).toBe(0);
  });
});

describe('payment check', () => {
  it('keeps an advance on top of the cash collected, and a return keeps Paid', async () => {
    const { paidAfterCheck } = await import('@/lib/courier-insight');
    expect(paidAfterCheck({ group: 'delivered', total: 1000, paid_amount: 1000, paid_before_delivery: 200 }, 750)).toBe(950);
    expect(paidAfterCheck({ group: 'delivered', total: 1000, paid_amount: 1000, paid_before_delivery: null }, 1200)).toBe(1000);
    expect(paidAfterCheck({ group: 'paid_return', total: 760, paid_amount: 0, paid_before_delivery: null }, 60)).toBe(60);
    expect(paidAfterCheck({ group: 'regular_return', total: 760, paid_amount: 150, paid_before_delivery: null }, 0)).toBe(150);
  });

  it('counts checked and unchecked finished parcels only', () => {
    const r = courierInsight([
      o({ status: 'delivered', courier_status: 'Delivered', paid_amount: 1000, payment_checked_at: '2026-11-10T10:00:00Z' }),
      o({ status: 'delivered', courier_status: 'Delivered', paid_amount: 1000 }),
      o({ status: 'shipped', courier_status: 'In_Transit' }),
    ]);
    expect([r.checked, r.unchecked]).toEqual([1, 1]);
  });
});

describe('COD fee rate by date', () => {
  it('uses the rate in force when the parcel was handed over, so a new rate never changes older parcels', async () => {
    const { rateFor, courierInsight: ci } = await import('@/lib/courier-insight');
    const rates = [
      { cod_rate: 1, effective_from: '2000-01-01T00:00:00Z' },
      { cod_rate: '0.5', effective_from: '2026-11-15T00:00:00Z' },
    ];
    expect(rateFor(rates, '2026-11-08T12:00:00Z')).toBe(1);
    expect(rateFor(rates, '2026-11-20T12:00:00Z')).toBe(0.5);
    expect(rateFor([], '2026-11-20T12:00:00Z')).toBe(1);
    const r = ci([
      o({ status: 'delivered', courier_status: 'Delivered', total: 1000, paid_amount: 1000, courier_sent_at: '2026-11-08T12:00:00Z' }),
      o({ status: 'delivered', courier_status: 'Delivered', total: 1000, paid_amount: 1000, courier_sent_at: '2026-11-20T12:00:00Z' }),
      o({ status: 'delivered', courier_status: 'Delivered', total: 1000, paid_amount: 1000, courier_sent_at: '2026-11-20T12:00:00Z', courier_cod_fee: 7 }),
    ], rates);
    expect(r.rows.map((x) => x.codFee)).toEqual([10, 5, 7]);
  });
});

describe('payment check list', () => {
  it('filters by view and searches order or consignment ID', async () => {
    const { filterParcels, courierInsight: ci } = await import('@/lib/courier-insight');
    const r = ci([
      o({ id: 'a', public_ref: 'SD0007', status: 'delivered', courier_status: 'Delivered', paid_amount: 1000, courier_consignment_id: 'DN081126CV4T4X' }),
      o({ id: 'b', public_ref: 'SD0008', status: 'delivered', courier_status: 'Delivered', paid_amount: 1000, payment_checked_at: '2026-11-10T10:00:00Z' }),
      o({ id: 'c', public_ref: 'SD0009', status: 'shipped', courier_status: 'In_Transit' }),
    ]);
    expect(filterParcels(r.rows, 'todo', '').map((x) => x.id)).toEqual(['a']);
    expect(filterParcels(r.rows, 'done', '').map((x) => x.id)).toEqual(['b']);
    expect(filterParcels(r.rows, 'all', '').length).toBe(3);
    expect(filterParcels(r.rows, 'all', 'cv4t').map((x) => x.id)).toEqual(['a']);
    expect(filterParcels(r.rows, 'all', 'sd0009').map((x) => x.id)).toEqual(['c']);
  });
});
