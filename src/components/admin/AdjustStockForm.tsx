'use client';

import { adjustStock } from '@/actions/admin-catalog';
import { FieldError, FormMessage, PendingButton, useKeepValuesAction } from './ui';

export function AdjustStockForm({ variantId, current }: { variantId: string; current: number }) {
  const { state, onSubmit, pending } = useKeepValuesAction(adjustStock);
  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate>
      <input type="hidden" name="variantId" value={variantId} />
      <p className="text-sm">Current stock: <strong>{current}</strong></p>
      <div className="grid gap-3 sm:grid-cols-[8rem_10rem_1fr_auto] sm:items-end">
        <div className="field">
          <label htmlFor="change" className="label">Change</label>
          <input id="change" name="change" type="number" step={1} placeholder="10 or -2" className="input" required />
          <FieldError state={state} name="change" />
        </div>
        <div className="field">
          <label htmlFor="reason" className="label">Reason</label>
          <select id="reason" name="reason" className="input" defaultValue="restock">
            <option value="restock">Restock (new delivery)</option>
            <option value="adjust">Adjust (count / damage)</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="note" className="label">Note</label>
          <input id="note" name="note" maxLength={300} placeholder="e.g. Supplier invoice 1182" className="input" />
        </div>
        <PendingButton pending={pending} pendingText="Saving…">Save</PendingButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
