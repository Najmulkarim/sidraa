/**
 * Turns database errors into plain messages. The SQL functions raise
 * SQLSTATE P0001 with a short code as the message and JSON in "details"
 * (see 0007_order_functions.sql). Anything unexpected becomes a generic
 * message for the visitor; the full error is logged on the server only.
 */

export type DbError = { message?: string; details?: string | null; code?: string; hint?: string | null } | null | undefined;

export type StockProblem = {
  variant_id: string;
  product_name: string | null;
  variant_label: string | null;
  requested: number;
  available: number;
};

export type MappedError = {
  code: string;
  message: string;
  field?: string;
  stock?: StockProblem[];
};

const KNOWN = new Set([
  'INVALID_INPUT', 'ZONE_INVALID', 'UNAVAILABLE', 'OUT_OF_STOCK', 'FORBIDDEN', 'BAD_TRANSITION', 'NEGATIVE_STOCK', 'NOT_FOUND',
  'BLOCKED', 'COUPON_INVALID', 'ALREADY_SENT', 'BUSY',
]);

function parseDetails(details: string | null | undefined): unknown {
  if (!details) return null;
  try {
    return JSON.parse(details);
  } catch {
    return null;
  }
}

export function describeStockProblem(p: StockProblem): string {
  const name = p.product_name ? `${p.product_name}${p.variant_label ? ` (${p.variant_label})` : ''}` : 'An item in your cart';
  if (p.available <= 0) return `${name} is sold out.`;
  return `${name}: only ${p.available} left, you asked for ${p.requested}.`;
}

export function mapDbError(error: DbError): MappedError {
  const code = error?.message ?? '';
  if (!KNOWN.has(code)) {
    if (error?.code === '23505') return { code: 'DUPLICATE', message: 'That value is already used — choose another.' };
    if (error?.code === '23503') return { code: 'IN_USE', message: 'This is still used elsewhere, so it cannot be removed.' };
    if (error?.code === '42501') return { code: 'FORBIDDEN', message: 'You do not have permission to do that.' };
    return { code: 'UNKNOWN', message: 'Something went wrong. Please try again.' };
  }
  const details = parseDetails(error?.details);

  switch (code) {
    case 'OUT_OF_STOCK': {
      const stock = Array.isArray(details) ? (details as StockProblem[]) : [];
      const message = stock.length
        ? stock.map(describeStockProblem).join(' ')
        : 'Some items are no longer available in the quantity you chose.';
      return { code, message, stock };
    }
    case 'INVALID_INPUT':
    case 'COUPON_INVALID':
    case 'ZONE_INVALID': {
      const d = (details ?? {}) as { field?: string; reason?: string };
      return { code, message: d.reason ?? 'Please check the form.', field: d.field };
    }
    case 'FORBIDDEN':
      return { code, message: 'You do not have permission to do that.' };
    case 'BAD_TRANSITION': {
      const d = (details ?? {}) as { from?: string; to?: string };
      return { code, message: `An order cannot move from ${d.from ?? 'its current status'} to ${d.to ?? 'that status'}.` };
    }
    case 'NEGATIVE_STOCK': {
      const d = (details ?? {}) as { stock?: number };
      return { code, message: `Stock cannot go below zero (currently ${d.stock ?? 0}).` };
    }
    case 'NOT_FOUND':
      return { code, message: 'Not found — it may have been removed.' };
    case 'BLOCKED':
      return { code, message: 'We could not take this order online. Please call us to order.', field: 'customer_phone' };
    case 'ALREADY_SENT': {
      const d = (details ?? {}) as { courier?: string; consignment_id?: string };
      return { code, message: `Already sent to the courier${d.consignment_id ? ` (consignment ${d.consignment_id})` : ''}.` };
    }
    case 'BUSY':
      return { code, message: 'This order is being sent right now. Wait a moment and refresh.' };
    default:
      return { code, message: 'This item is not available.' };
  }
}

/** Maps a DB field name from a function's detail JSON to the form field name. */
export const DB_FIELD_TO_FORM: Record<string, string> = {
  customer_name: 'customerName',
  customer_phone: 'customerPhone',
  address: 'address',
  district: 'district',
  zone_id: 'zoneId',
  note: 'note',
  items: 'items',
  idempotency_key: 'idempotencyKey',
  coupon_code: 'couponCode',
  discount: 'discount',
  delivery_charge: 'deliveryCharge',
  source: 'source',
};
