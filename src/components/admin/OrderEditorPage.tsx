'use client';

import { useRouter } from 'next/navigation';
import type { DeliveryZone, EditableOrder, VariantOption } from '@/lib/types';
import { OrderEditor } from './OrderEditor';

/** Full-page editor: goes to the order after saving. */
export function OrderEditorPage({ order, options, zones }: { order?: EditableOrder; options: VariantOption[]; zones: DeliveryZone[] }) {
  const router = useRouter();
  return (
    <OrderEditor
      order={order}
      options={options}
      zones={zones}
      onCancel={() => router.back()}
      onSaved={(r) => r.values?.orderId && router.push(`/admin/orders/${r.values.orderId}?saved=1`)}
    />
  );
}
