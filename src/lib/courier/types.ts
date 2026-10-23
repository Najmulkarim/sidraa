/** Shared shapes for the courier clients. Safe to import anywhere. */
export type CourierName = 'steadfast' | 'pathao';

export const COURIER_LABEL: Record<CourierName, string> = { steadfast: 'Steadfast', pathao: 'Pathao' };

/** What we hand to a courier — built from the database row, never from the browser. */
export type Parcel = {
  public_ref: string;
  customer_name: string;
  customer_phone: string;
  address: string;
  district: string;
  note: string | null;
  cod_amount: number;
  item_quantity: number;
  item_description: string;
};

export type Booking = { consignment_id: string; tracking_code: string | null; status: string; charge: number | null };

export type PathaoLocation = { city_id?: number; zone_id?: number; area_id?: number };

/** Human label for a raw courier status ("partial_delivered" → "Partial delivered"). */
export function courierStatusLabel(raw: string | null): string {
  if (!raw) return '';
  const s = raw.replace(/^order[._]/i, '').replace(/[_.\s]+/g, ' ').trim().toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Courier status → order status. Mirrors public.courier_status_to_order()
 * in 0011; the database applies it, this copy is for display and tests.
 */
export function courierStatusToOrder(raw: string | null): 'delivered' | 'returned' | null {
  const s = (raw ?? '').trim().toLowerCase().replace(/[^a-z]+/g, '_').replace(/^order_|_$/g, '');
  if (['delivered', 'partial_delivered', 'partial_delivery', 'delivered_approval_pending', 'partial_delivered_approval_pending'].includes(s)) return 'delivered';
  if (['cancelled', 'cancelled_approval_pending', 'return', 'returned', 'paid_return', 'return_to_merchant', 'returned_to_merchant', 'pickup_cancel', 'pickup_cancelled'].includes(s)) return 'returned';
  return null;
}

export class CourierError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'CourierError';
  }
}
