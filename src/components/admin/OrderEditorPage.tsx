'use client';

import { useRouter } from 'next/navigation';
import { markIncompleteConverted } from '@/actions/admin-incomplete';
import type { DeliveryZone, EditableOrder, VariantOption } from '@/lib/types';
import { OrderEditor, type OrderPrefill } from './OrderEditor';
import { notify } from './Toaster';

/** Full-page editor: goes to the order after saving. Made from an incomplete order, it marks that one done. */
export function OrderEditorPage({ order, prefill, draftId, options, zones }: { order?: EditableOrder; prefill?: OrderPrefill; draftId?: string; options: VariantOption[]; zones: DeliveryZone[] }) {
  const router = useRouter();
  return (
    <OrderEditor
      order={order}
      prefill={prefill}
      options={options}
      zones={zones}
      onCancel={() => router.back()}
      onSaved={async (r) => {
        const orderId = r.values?.orderId;
        if (!orderId) return;
        if (draftId) {
          const done = await markIncompleteConverted(draftId, orderId);
          if (!done.ok && done.message) notify(false, done.message);
        }
        router.push(`/admin/orders/${orderId}?saved=1`);
      }}
    />
  );
}
