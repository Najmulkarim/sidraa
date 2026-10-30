import { describe, expect, it } from 'vitest';
import { ownHistory, parseCourierHistory, successPercent, type OwnOrder } from '@/lib/courier/history';

describe('customer delivery record', () => {
  it('reads the courier answer and adds up the summary itself', () => {
    const r = parseCourierHistory({
      status: 'success',
      courierData: {
        pathao: { name: 'Pathao', total_parcel: 5, success_parcel: 4, cancelled_parcel: 1 },
        redx: { name: 'RedX', total_parcel: 0, success_parcel: 0, cancelled_parcel: 0 },
        summary: { total_parcel: 99, success_parcel: 99, cancelled_parcel: 0 },
      },
    });
    expect(r?.couriers.map((c) => c.name)).toEqual(['Pathao']);
    expect(r?.summary).toEqual({ name: 'All couriers', total: 5, delivered: 4, failed: 1 });
  });

  it('returns null for an answer it cannot read', () => {
    expect(parseCourierHistory({ status: 'error' })).toBeNull();
    expect(parseCourierHistory({ courierData: { summary: {} } })).toBeNull();
    expect(parseCourierHistory(null)).toBeNull();
  });

  it('does not count a cancelled pickup against the customer', () => {
    const orders: OwnOrder[] = [
      { courier: 'pathao', status: 'cancelled', courier_status: 'Pickup_Cancelled' },
      { courier: 'pathao', status: 'delivered', courier_status: 'Delivered' },
      { courier: 'pathao', status: 'returned', courier_status: 'Return' },
      { courier: null, status: 'pending', courier_status: null },
    ];
    expect(ownHistory(orders, (c) => c)).toEqual({ couriers: [{ name: 'pathao', total: 2, delivered: 1, failed: 1 }], pickupCancelled: 1, total: 4 });
  });

  it('has no rate until a parcel has finished', () => {
    expect(successPercent({ delivered: 0, failed: 0 })).toBeNull();
    expect(successPercent({ delivered: 3, failed: 1 })).toBe(75);
  });
});
