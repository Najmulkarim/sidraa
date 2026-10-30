'use client';

import { useActionState } from 'react';
import { changeOrderStatus } from '@/actions/admin-orders';
import { nextStatusesFor, STATUS_LABEL, type OrderStatus } from '@/lib/order-status';
import type { ActionState } from '@/lib/types';
import { FormMessage, SubmitButton } from './ui';

const initial: ActionState = { ok: false };

export function StatusForm({ orderId, status, courierStatus }: { orderId: string; status: OrderStatus; courierStatus?: string | null }) {
  const [state, action] = useActionState(changeOrderStatus, initial);
  const options = nextStatusesFor(status, courierStatus);

  if (options.length === 0) {
    return <p className="text-sm text-muted">This order is {STATUS_LABEL[status].toLowerCase()} — its status is final.</p>;
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      <div className="field">
        <label htmlFor="status" className="label">Move to</label>
        <select key={status} id="status" name="status" className="input" defaultValue={options[0]}>
          {options.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
              {s === 'cancelled' || s === 'returned' ? ' (puts stock back)' : ''}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="note" className="label">Note (optional)</label>
        <input id="note" name="note" maxLength={500} placeholder="e.g. Customer confirmed by phone" className="input" />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Updating…" className="btn btn-primary w-full">Update status</SubmitButton>
    </form>
  );
}
