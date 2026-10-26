import { formatTaka } from './format';
import type { DeliveryZone } from './types';

/**
 * The free-delivery promise, worded so it is true for every customer: when only
 * some areas get free delivery, it names them ("… (Inside Dhaka & Dhaka suburbs)").
 * null when no area has free delivery.
 */
export function freeDelivery(zones: Pick<DeliveryZone, 'name' | 'free_over' | 'is_active'>[]): { over: string; where: string | null; text: string } | null {
  const active = zones.filter((z) => z.is_active !== false);
  const free = active.filter((z) => z.free_over !== null);
  if (!free.length) return null;
  const over = formatTaka(Math.min(...free.map((z) => Number(z.free_over))));
  const where = free.length === active.length ? null : free.length <= 2 ? free.map((z) => z.name).join(' & ') : 'selected areas';
  return { over, where, text: `on orders over ${over}${where ? ` (${where})` : ''}` };
}
