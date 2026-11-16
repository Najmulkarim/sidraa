import { describe, expect, it } from 'vitest';
import { buildReport, change, dhakaParts, outcomeOf, type ReportOrder } from '@/lib/advanced-report';

const o = (p: Partial<ReportOrder>): ReportOrder => ({
  id: Math.random().toString(36), status: 'pending', total: 1000, created_at: '2026-11-10T04:00:00Z',
  confirmed_at: null, shipped_at: null, delivered_at: null, courier_sent_at: null, source: 'website', landing_slug: null,
  coupon_code: null, district: 'Dhaka', courier: null, courier_consignment_id: null, assigned_to: null, customer_phone: '01711000001', items: [], ...p,
});

describe('advanced report', () => {
  it('sorts orders into outcomes', () => {
    expect(['delivered', 'returned', 'lost', 'cancelled', 'fake', 'shipped', 'pending'].map(outcomeOf))
      .toEqual(['delivered', 'returned', 'returned', 'cancelled', 'cancelled', 'active', 'active']);
  });

  it('reads Dhaka day, weekday and hour', () => {
    // 2026-11-10 20:30 UTC = 11 Nov 02:30 in Dhaka (a Wednesday).
    expect(dhakaParts('2026-11-10T20:30:00Z')).toEqual({ day: '2026-11-11', weekday: 3, hour: 2 });
  });

  it('adds up outcomes, rates, profit, funnel, products and sources', () => {
    const items = (cost: number | null) => [{ product_id: 'p1', product_name: 'Slipper', quantity: 2, line_total: 900, unit_cost: cost }];
    const r = buildReport([
      o({ status: 'delivered', total: 970, confirmed_at: 'x', courier: 'pathao', courier_consignment_id: 'C1', courier_sent_at: '2026-11-10T06:00:00Z', delivered_at: '2026-11-12T06:00:00Z', items: items(300), assigned_to: 'u1' }),
      o({ status: 'returned', total: 970, confirmed_at: 'x', courier: 'pathao', courier_consignment_id: 'C2', courier_sent_at: '2026-11-10T06:00:00Z', items: items(300), customer_phone: '01711000002' }),
      o({ status: 'cancelled', total: 500, source: 'phone', district: ' ', customer_phone: '01711000003' }),
      o({ status: 'pending', total: 1500, landing_slug: 'winter', coupon_code: 'EID', items: items(null) }),
    ], { days: ['2026-11-10'], products: new Map([['p1', { category: 'Footwear', stock: 5 }]]), returningPhones: new Set(['01711000001']), staffNames: new Map([['u1', 'Saykot']]) });

    expect(r.summary).toMatchObject({ orders: 4, value: 3940, aov: 985, delivered: 1, returned: 1, cancelled: 1, active: 1, successRate: 50, returnRate: 50, cancelRate: 25, productRevenue: 900, grossProfit: 300, grossMargin: 33.3, customers: 3, newCustomers: 2, returningCustomers: 1 });
    expect(r.funnel.map((f) => f.count)).toEqual([4, 2, 2, 1]);
    expect(r.daily[0]).toMatchObject({ orders: 4, delivered: 1, returned: 1, cancelled: 1, active: 1 });
    const p = r.products[0]!;
    expect(p).toMatchObject({ name: 'Slipper', category: 'Footwear', orders: 3, units: 6, deliveredUnits: 2, returnedUnits: 2, revenue: 900, cost: 600, profit: 300, margin: 33.3, returnRate: 50, stock: 5 });
    expect(r.categories[0]).toMatchObject({ name: 'Footwear', units: 6 });
    expect(r.districts.find((d) => d.name === 'Unknown')?.orders).toBe(1);
    expect(r.sources.map((s) => [s.key, s.orders])).toEqual([['website', 2], ['landing', 1], ['manual', 1], ['coupon', 1]]);
    expect(r.staff.find((s) => s.id === 'u1')?.name).toBe('Saykot');
    expect(r.couriers[0]).toMatchObject({ name: 'pathao', sent: 2, delivered: 1, returned: 1, successRate: 50, avgDays: 2 });
    expect(r.heat[2]![10]).toBe(4); // 10 Nov 04:00 UTC = Tuesday 10:00 in Dhaka
  });

  it('counts a customer who ordered twice in the period as returning', () => {
    const r = buildReport([o({ customer_phone: '01700000009' }), o({ customer_phone: '01700000009' }), o({ customer_phone: '01700000008' })], { days: [], returningPhones: new Set() });
    expect([r.summary.customers, r.summary.newCustomers, r.summary.returningCustomers]).toEqual([2, 1, 1]);
  });

  it('measures change from the previous period', () => {
    expect(change(150, 100)).toBe(50);
    expect(change(50, 100)).toBe(-50);
    expect(change(5, 0)).toBeNull();
    expect(change(0, 0)).toBe(0);
  });
});
