import { describe, expect, it } from 'vitest';
import { deliveredQuantities } from '@/lib/delivered-items';
import { costRow } from '@/lib/order-costs';

const slippers = [
  { id: 'a', product_name: 'Slipper', variant_label: 'Pink', quantity: 1, unit_price: 840, unit_cost: 340 },
  { id: 'b', product_name: 'Slipper', variant_label: 'Mint', quantity: 1, unit_price: 840, unit_cost: 340 },
];

describe('deliveredQuantities', () => {
  it('counts every piece of a normal order', () => {
    expect(deliveredQuantities({ total: 1750, paid_amount: 1750 }, slippers)).toEqual([1, 1]);
  });

  it('counts no piece of an exchange', () => {
    expect(deliveredQuantities({ courier_outcome: 'exchange', total: 0, paid_amount: 0 }, slippers)).toEqual([0, 0]);
  });

  it('counts the pieces the collected cash paid for (SD0128: 910 = one slipper + delivery)', () => {
    const o = { courier_outcome: 'partial', total: 1750, paid_amount: 910, delivery_charge: 70, discount: 0 };
    expect(deliveredQuantities(o, slippers)).toEqual([1, 0]);
  });

  it('handles several pieces on one line and the most expensive first', () => {
    const items = [{ quantity: 3, unit_price: 300 }, { quantity: 1, unit_price: 900 }];
    const o = { courier_outcome: 'partial', total: 1870, paid_amount: 1570, delivery_charge: 70, discount: 0 };
    expect(deliveredQuantities(o, items)).toEqual([2, 1]);
  });
});

describe('costRow with partial delivery and exchange', () => {
  const base = { id: 'o', public_ref: 'SD0128', status: 'delivered' as const, counted_at: '2026-11-22', paid_before_delivery: 0,
    courier: 'pathao', courier_consignment_id: 'X', courier_charge: 60, courier_cod_fee: 9.1, courier_sent_at: null };

  it('counts the product cost of delivered pieces only', () => {
    const r = costRow({ ...base, total: 1750, paid_amount: 910, delivery_charge: 70, discount: 0, courier_outcome: 'partial', items: slippers }, {});
    expect(r.income).toBe(910);
    expect(r.productCost).toBe(340);
  });

  it('counts no product cost for an exchange', () => {
    const r = costRow({ ...base, total: 0, paid_amount: 0, delivery_charge: 70, discount: 420, courier_outcome: 'exchange', courier_cod_fee: 0, items: [slippers[0]!] }, {});
    expect(r.income).toBe(0);
    expect(r.productCost).toBe(0);
    expect(r.net).toBe(-60);
  });
});
