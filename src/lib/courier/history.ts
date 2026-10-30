import { isPickupCancelled, type OrderStatus } from '@/lib/order-status';

/** One row of the delivery record: a courier, or everything together. */
export type CourierRow = { name: string; total: number; delivered: number; failed: number };

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
};

/** Reads BD Courier's answer: { courierData: { pathao: { name, total_parcel, success_parcel, cancelled_parcel }, …, summary } }. */
export function parseCourierHistory(body: unknown): { couriers: CourierRow[]; summary: CourierRow } | null {
  const data = (body as { courierData?: unknown; data?: unknown } | null)?.courierData ?? (body as { data?: unknown } | null)?.data;
  if (!data || typeof data !== 'object') return null;
  const couriers: CourierRow[] = [];
  for (const [key, raw] of Object.entries(data as Record<string, unknown>)) {
    if (key === 'summary' || !raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    if (!('total_parcel' in r)) continue;
    couriers.push({ name: typeof r.name === 'string' && r.name ? r.name : key, total: num(r.total_parcel), delivered: num(r.success_parcel), failed: num(r.cancelled_parcel) });
  }
  if (!couriers.length) return null;
  const add = (k: 'total' | 'delivered' | 'failed') => couriers.reduce((sum, c) => sum + c[k], 0);
  return { couriers: couriers.filter((c) => c.total > 0), summary: { name: 'All couriers', total: add('total'), delivered: add('delivered'), failed: add('failed') } };
}

export type OwnOrder = { courier: string | null; status: OrderStatus; courier_status: string | null };

/** This shop's own orders for a customer, by courier. Cancelled pickups are counted apart: they say nothing about the customer. */
export function ownHistory(orders: OwnOrder[], label: (courier: string) => string): { couriers: CourierRow[]; pickupCancelled: number; total: number } {
  const rows = new Map<string, CourierRow>();
  let pickupCancelled = 0;
  for (const o of orders) {
    if (o.status === 'cancelled' && isPickupCancelled(o.courier_status)) {
      pickupCancelled++;
      continue;
    }
    if (!o.courier) continue;
    const name = label(o.courier);
    const row = rows.get(name) ?? { name, total: 0, delivered: 0, failed: 0 };
    row.total++;
    if (o.status === 'delivered') row.delivered++;
    else if (['returned', 'cancelled', 'fake', 'lost'].includes(o.status)) row.failed++;
    rows.set(name, row);
  }
  return { couriers: [...rows.values()], pickupCancelled, total: orders.length };
}

/** Success rate from finished parcels only; null while nothing has finished. */
export function successPercent(r: Pick<CourierRow, 'delivered' | 'failed'>): number | null {
  const finished = r.delivered + r.failed;
  return finished ? Math.round((r.delivered / finished) * 100) : null;
}
