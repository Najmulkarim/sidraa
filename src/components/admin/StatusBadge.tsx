import { isPickupCancelled, STATUS_LABEL, type OrderStatus } from '@/lib/order-status';

const TONE: Record<OrderStatus, string> = {
  pending: 'bg-[#eef2ff] text-[#4338ca]',
  confirmed: 'bg-tint text-brand',
  processing: 'bg-[#ecfeff] text-[#0e7490]',
  hold: 'bg-[#fef3c7] text-[#92400e]',
  ship_later: 'bg-[#f5f3ff] text-[#6d28d9]',
  shipped: 'bg-[#e0f2fe] text-[#0369a1]',
  delivered: 'bg-[#dcfce7] text-[#15803d]',
  cancelled: 'bg-[#fee2e2] text-[#b91c1c]',
  returned: 'bg-[#ffedd5] text-[#c2410c]',
  lost: 'bg-[#f3f4f6] text-[#374151]',
  fake: 'bg-[#1f1d2b] text-white',
};

export function StatusBadge({ status, courierStatus }: { status: OrderStatus; courierStatus?: string | null }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${TONE[status]}`}>{status === 'cancelled' && isPickupCancelled(courierStatus) ? 'Pickup cancelled' : STATUS_LABEL[status]}</span>;
}
