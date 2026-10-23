'use client';

import { useEffect, useState } from 'react';
import { getOrderEditor, type EditorData } from '@/actions/admin-orders';
import { isEditable } from '@/lib/order-status';
import type { ActionState } from '@/lib/types';
import { Icon } from '../icons';
import { EditOrderDialog } from './EditOrderDialog';
import { OrderEditor } from './OrderEditor';
import type { OrderRow } from './OrdersTable';

/**
 * Edit button in the orders table. Staff with "orders_edit" get the full
 * editor (items, sizes, prices, delivery, discount) while the order is
 * open and not yet booked with a courier; everyone else gets customer
 * details and the paid amount.
 */
export function OrderEditDialog({ order, onClose, onSaved }: { order: OrderRow; onClose: () => void; onSaved: (r: ActionState) => void }) {
  const [data, setData] = useState<EditorData | null>(null);

  useEffect(() => {
    let live = true;
    getOrderEditor(order.id).then((d) => live && setData(d));
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      live = false;
      window.removeEventListener('keydown', onKey);
    };
  }, [order.id, onClose]);

  const full = data?.ok && data.canEditItems && data.order && isEditable(data.order.status) && !data.order.courier_consignment_id;
  if (data && !full) return <EditOrderDialog order={order} editable={isEditable(order.status) && !data.order?.courier_consignment_id} onClose={onClose} onSaved={onSaved} />;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-night/40 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="oe-title" onClick={(e) => e.stopPropagation()} className="max-h-[94dvh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <header className="mb-4 flex items-start justify-between">
          <div>
            <h2 id="oe-title" className="text-lg font-bold">Edit order</h2>
            <p className="font-mono text-[12px] text-muted">{order.public_ref}</p>
          </div>
          <button type="button" className="grid h-9 w-9 place-items-center rounded-lg hover:bg-soft" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
        </header>
        {!data ? (
          <p className="py-10 text-center text-sm text-muted">Loading…</p>
        ) : (
          <OrderEditor order={data.order} options={data.options ?? []} zones={data.zones ?? []} onCancel={onClose} onSaved={onSaved} />
        )}
      </div>
    </div>
  );
}
