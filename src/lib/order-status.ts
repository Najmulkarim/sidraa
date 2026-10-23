/** Order status workflow. Mirrors public.allowed_next_statuses() in
 *  0010_order_operations.sql; the database is the authority — this file
 *  only decides which options and buttons to show. */

export const ORDER_STATUSES = [
  'pending', 'confirmed', 'processing', 'hold', 'ship_later', 'shipped', 'delivered', 'cancelled', 'returned', 'lost', 'fake',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

const FORWARD: OrderStatus[] = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];

/** Admin names, matching the tabs on the Orders page. */
export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'New',
  confirmed: 'Confirmed',
  processing: 'Ready to deliver',
  hold: 'Hold',
  ship_later: 'Ship later',
  shipped: 'In courier',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  returned: 'Returned',
  lost: 'Lost',
  fake: 'Fake',
};

/** Customer-facing names (tracking, confirmation). */
export const CUSTOMER_LABEL: Record<OrderStatus, string> = {
  pending: 'Received',
  confirmed: 'Confirmed',
  processing: 'Packing',
  hold: 'On hold',
  ship_later: 'Scheduled',
  shipped: 'On the way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  returned: 'Returned',
  lost: 'Delayed',
  fake: 'Cancelled',
};

export const STATUS_HINT: Record<OrderStatus, string> = {
  pending: 'We received your order and will call to confirm it.',
  confirmed: 'Your order is confirmed.',
  processing: 'Your order is being packed.',
  hold: 'Your order is on hold. We will call you before sending it.',
  ship_later: 'Your order will be sent on the date you agreed with us.',
  shipped: 'Your parcel is on the way. Keep the cash ready for the rider.',
  delivered: 'Delivered. Thank you for shopping with us.',
  cancelled: 'This order was cancelled.',
  returned: 'This order was returned.',
  lost: 'There is a problem with the delivery. We will contact you.',
  fake: 'This order was cancelled.',
};

const NEXT: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'processing', 'shipped', 'delivered', 'hold', 'ship_later', 'cancelled', 'fake'],
  confirmed: ['processing', 'shipped', 'delivered', 'hold', 'ship_later', 'cancelled', 'fake'],
  processing: ['shipped', 'delivered', 'hold', 'ship_later', 'cancelled'],
  hold: ['pending', 'confirmed', 'processing', 'shipped', 'ship_later', 'cancelled', 'fake'],
  ship_later: ['pending', 'confirmed', 'processing', 'shipped', 'hold', 'cancelled', 'fake'],
  shipped: ['delivered', 'returned', 'lost'],
  delivered: ['returned'],
  cancelled: [],
  returned: [],
  lost: [],
  fake: [],
};

/** Statuses that return stock when an order moves into them. */
export const RESTOCKING: OrderStatus[] = ['cancelled', 'returned', 'fake'];
export const FINAL: OrderStatus[] = ['cancelled', 'returned', 'lost', 'fake'];

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === 'string' && (ORDER_STATUSES as readonly string[]).includes(value);
}

/** Statuses an admin may move an order to from `from`. */
export function nextStatuses(from: OrderStatus): OrderStatus[] {
  return NEXT[from];
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return NEXT[from].includes(to);
}

/** Can the customer details still be edited? (Not once the courier has it.) */
export function isEditable(status: OrderStatus): boolean {
  return ['pending', 'confirmed', 'processing', 'hold', 'ship_later'].includes(status);
}

/** Steps for the customer-facing progress bar. Hold / ship later sit at "confirmed". */
export function progressSteps(status: OrderStatus): { key: OrderStatus; label: string; done: boolean; current: boolean }[] {
  const at = status === 'hold' || status === 'ship_later' ? 'confirmed' : status;
  const reached = FORWARD.indexOf(at);
  return FORWARD.map((key, i) => ({
    key,
    label: CUSTOMER_LABEL[key],
    done: reached >= 0 && i <= reached,
    current: i === reached,
  }));
}
