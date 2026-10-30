import { describe, expect, it } from 'vitest';
import { courierStatusLabel, courierStatusToOrder } from '@/lib/courier/types';
import { errorMessage } from '@/lib/courier/http-errors';
import { hashedUserData, normCity, normPhoneBd, sha256, splitName } from '@/lib/facebook/hash';
import { addLine, availableFor, editorTotals, zoneCharge } from '@/lib/order-editor';
import { capabilitiesFor, DEFAULT_ROLE_PERMISSIONS, isPermission, PERMISSIONS } from '@/lib/permissions';
import { couponSchema, orderEditSchema, staffSchema } from '@/lib/validation';

const V = (n: number) => `b0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ZONE = '0b6c3c2e-0000-4000-8000-000000000001';

describe('permissions', () => {
  it('super admin gets everything plus staff', () => {
    const c = capabilitiesFor('super_admin', []);
    expect(PERMISSIONS.every((p) => c.has(p))).toBe(true);
    expect(c.has('staff')).toBe(true);
  });
  it('other roles get only granted, known permissions — never staff', () => {
    const c = capabilitiesFor('support', ['orders', 'staff', 'nonsense']);
    expect([...c]).toEqual(['orders']);
  });
  it('default matrix keeps settings away from managers', () => {
    expect(DEFAULT_ROLE_PERMISSIONS.manager.includes('store_settings')).toBe(false);
    expect(DEFAULT_ROLE_PERMISSIONS.support.includes('revenue')).toBe(false);
    expect(isPermission('courier')).toBe(true);
    expect(isPermission('staff')).toBe(false);
  });
});

describe('order editor arithmetic', () => {
  const zone = { id: ZONE, charge: '70', free_over: '3000' };
  it('charges the zone until the free-delivery threshold (after discount)', () => {
    expect(zoneCharge(zone, 2999)).toBe(70);
    expect(zoneCharge(zone, 3000)).toBe(0);
    expect(zoneCharge(undefined, 100)).toBe(0);
  });
  it('totals with discount and a hand-set delivery charge', () => {
    const lines = [{ variantId: V(1), quantity: 2, unitPrice: 1290 }, { variantId: V(2), quantity: 1, unitPrice: 800 }];
    expect(editorTotals(lines, 100, zone, null)).toEqual({ subtotal: 3380, discount: 100, delivery: 0, total: 3280 });
    expect(editorTotals(lines, 500, zone, null).delivery).toBe(70);
    expect(editorTotals(lines, 0, zone, 0).total).toBe(3380);
    expect(editorTotals(lines, 99999, zone, null).discount).toBe(3380);
  });
  it('adding the same size bumps the quantity', () => {
    const one = addLine([], V(1), 500);
    expect(addLine(one, V(1), 500)).toEqual([{ variantId: V(1), quantity: 2, unitPrice: 500 }]);
  });
  it('units already in the order count as available', () => {
    expect(availableFor(V(1), 1, [{ variant_id: V(1), quantity: 2 }, { variant_id: V(2), quantity: 5 }])).toBe(3);
  });
});

describe('orderEditSchema', () => {
  const base = {
    orderId: '00000000-0000-4000-8000-000000000001',
    customerName: 'Rina Akter', customerPhone: '+880 1711-222333', address: 'House 1, Road 2, Mirpur', district: 'Dhaka',
    zoneId: ZONE, source: 'facebook', discount: '', deliveryCharge: '',
    items: JSON.stringify([{ variantId: V(1), quantity: 2, unitPrice: 1290 }]),
  };
  it('accepts a full edit and normalises the phone', () => {
    const r = orderEditSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.customerPhone).toBe('01711222333');
      expect(r.data.discount).toBe(0);
      expect(r.data.deliveryCharge).toBeUndefined();
    }
  });
  it('refuses a discount above the items total', () => {
    expect(orderEditSchema.safeParse({ ...base, discount: '5000' }).success).toBe(false);
  });
  it('needs an order id or an idempotency key', () => {
    const { orderId: _drop, ...rest } = base;
    expect(orderEditSchema.safeParse(rest).success).toBe(false);
    expect(orderEditSchema.safeParse({ ...rest, idempotencyKey: '00000000-0000-4000-8000-0000000000aa' }).success).toBe(true);
  });
  it('refuses zero quantities and unknown sources', () => {
    expect(orderEditSchema.safeParse({ ...base, items: JSON.stringify([{ variantId: V(1), quantity: 0, unitPrice: 1 }]) }).success).toBe(false);
    expect(orderEditSchema.safeParse({ ...base, source: 'tv' }).success).toBe(false);
  });
});

describe('coupon and staff schemas', () => {
  it('caps percent coupons at 90 and orders the dates', () => {
    const ok = { code: 'eid10', kind: 'percent', value: '10', minSubtotal: '', isActive: 'on' };
    const r = couponSchema.safeParse(ok);
    expect(r.success && r.data.code).toBe('EID10');
    expect(couponSchema.safeParse({ ...ok, value: '95' }).success).toBe(false);
    expect(couponSchema.safeParse({ ...ok, startsAt: '2026-10-10', endsAt: '2026-10-01' }).success).toBe(false);
  });
  it('new staff need an email and a 10+ character password', () => {
    expect(staffSchema.safeParse({ fullName: 'Mina', role: 'manager', isActive: 'on' }).success).toBe(false);
    expect(staffSchema.safeParse({ fullName: 'Mina', role: 'manager', email: 'mina@example.com', password: 'short' }).success).toBe(false);
    expect(staffSchema.safeParse({ fullName: 'Mina', role: 'manager', email: 'mina@example.com', password: 'long-enough-1' }).success).toBe(true);
    expect(staffSchema.safeParse({ userId: '00000000-0000-4000-8000-000000000001', fullName: 'Mina', role: 'owner' }).success).toBe(false);
  });
});

describe('courier', () => {
  it('maps Steadfast and Pathao statuses like the database does', () => {
    expect(courierStatusToOrder('delivered_approval_pending')).toBe('delivered');
    expect(courierStatusToOrder('Partial_Delivery')).toBe('delivered');
    expect(courierStatusToOrder('order.delivered')).toBe('delivered');
    expect(courierStatusToOrder('Pickup_Cancelled')).toBe('cancelled');
    expect(courierStatusToOrder('Return')).toBe('returned');
    expect(courierStatusToOrder('cancelled')).toBe('returned');
    expect(courierStatusToOrder('In_Transit')).toBeNull();
    expect(courierStatusToOrder('hold')).toBeNull();
    expect(courierStatusToOrder(null)).toBeNull();
  });
  it('labels raw statuses for people', () => {
    expect(courierStatusLabel('partial_delivered_approval_pending')).toBe('Partial delivered approval pending');
    expect(courierStatusLabel('order.picked')).toBe('Picked');
  });
  it('reads courier error bodies', () => {
    expect(errorMessage({ errors: { recipient_phone: ['The recipient phone must be 11 digits.'] } })).toBe('The recipient phone must be 11 digits.');
    expect(errorMessage({ message: 'Invalid Credentials' })).toBe('Invalid Credentials');
    expect(errorMessage('nope')).toBeNull();
  });
});

describe('Facebook hashing', () => {
  it('formats before hashing as Meta asks', () => {
    expect(normPhoneBd('01711222333')).toBe('8801711222333');
    expect(normPhoneBd('12345')).toBeNull();
    expect(splitName('  Rina   Akter Khan ')).toEqual({ fn: 'rina', ln: 'khan' });
    expect(normCity("Cox's Bazar")).toBe('coxsbazar');
    expect(sha256('bd')).toBe('5e657ff6158d3e2a6d23e2a523917a2305acee9423365e268695c4b7b8919f4c');
  });
  it('never sends raw personal data', () => {
    const u = hashedUserData({ phone: '01711222333', name: 'Rina Akter', district: 'Dhaka' });
    expect(JSON.stringify(u).includes('01711222333')).toBe(false);
    expect(JSON.stringify(u).toLowerCase().includes('rina')).toBe(false);
    expect(u.ph?.[0]).toBe(sha256('8801711222333'));
    expect(u.ph?.[0]).toHaveLength(64);
  });
});
