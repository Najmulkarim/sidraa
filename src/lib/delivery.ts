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

/**
 * The delivery area a district points to, for staff typing an order: Dhaka is
 * Inside Dhaka (a Dhaka-suburbs choice is kept: Savar, Keraniganj… are in
 * Dhaka district), any other district is Outside Dhaka. Zones are found by
 * name; null = leave the area as it is (unknown district, or no such zone).
 */
export function zoneForDistrict(
  district: string,
  zones: Pick<DeliveryZone, 'id' | 'name' | 'is_active'>[],
  known: readonly string[],
  currentZoneId: string | null = null,
): string | null {
  const d = district.trim().toLowerCase();
  if (!d || !known.some((k) => k.toLowerCase() === d)) return null;
  const active = zones.filter((z) => z.is_active !== false);
  const find = (re: RegExp) => active.find((z) => re.test(z.name))?.id ?? null;
  if (d === 'dhaka') {
    const current = active.find((z) => z.id === currentZoneId);
    if (current && /dhaka/i.test(current.name) && !/outside/i.test(current.name)) return null;
    return find(/inside\s*dhaka/i);
  }
  return find(/outside\s*dhaka/i);
}
