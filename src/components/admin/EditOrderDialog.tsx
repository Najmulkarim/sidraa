'use client';

import { useEffect } from 'react';
import { editOrder } from '@/actions/admin-orders';
import { toNumber } from '@/lib/format';
import type { ActionState } from '@/lib/types';
import { Icon } from '../icons';
import type { OrderRow } from './OrdersTable';
import { FieldError, FormMessage, PendingButton, useKeepValuesAction } from './ui';

/** Edit customer details (until the parcel goes to the courier) and the paid amount. */
export function EditOrderDialog({ order: o, editable, onClose, onSaved }: { order: OrderRow; editable: boolean; onClose: () => void; onSaved: (r: ActionState) => void }) {
  const { state, onSubmit, pending } = useKeepValuesAction(editOrder);

  useEffect(() => {
    if (state.ok) onSaved(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const field = (name: string, label: string, value: string | null, props: Record<string, unknown> = {}) => (
    <div className="field">
      <label htmlFor={`eo-${name}`} className="label">{label}</label>
      <input id={`eo-${name}`} name={name} defaultValue={value ?? ''} readOnly={!editable} className={`input ${!editable ? 'bg-soft text-muted' : ''}`} {...props} />
      <FieldError state={state} name={name} />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-night/40 p-4" onClick={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-title"
        onSubmit={onSubmit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
        noValidate
      >
        <header className="flex items-start justify-between">
          <div>
            <h2 id="edit-title" className="text-lg font-bold">Edit order</h2>
            <p className="font-mono text-[12px] text-muted">{o.public_ref}</p>
          </div>
          <button type="button" className="grid h-9 w-9 place-items-center rounded-lg hover:bg-soft" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
        </header>
        {!editable && <p className="rounded-lg bg-soft px-3 py-2 text-[12.5px] text-muted">The parcel is already with the courier (or the order is closed), so only the paid amount can change.</p>}
        <input type="hidden" name="orderId" value={o.id} />
        <div className="grid gap-3 sm:grid-cols-2">
          {field('customerName', 'Customer name', o.customer_name, { maxLength: 80 })}
          {field('customerPhone', 'Mobile number', o.customer_phone, { inputMode: 'tel', maxLength: 20 })}
        </div>
        {field('address', 'Address', o.address, { maxLength: 300 })}
        <div className="grid gap-3 sm:grid-cols-2">
          {field('district', 'District', o.district, { maxLength: 60 })}
          {field('area', 'Area / thana', o.area, { maxLength: 60 })}
        </div>
        {field('note', 'Customer note', o.note, { maxLength: 500 })}
        <div className="field">
          <label htmlFor="eo-paid" className="label">Paid so far ৳ <span className="font-normal text-muted">(advance by bKash/Nagad, of {toNumber(o.total)})</span></label>
          <input id="eo-paid" name="paid" inputMode="decimal" defaultValue={String(toNumber(o.paid_amount))} className="input" />
          <FieldError state={state} name="paid" />
        </div>
        {!state.ok && <FormMessage state={state} />}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <PendingButton pending={pending}>Save changes</PendingButton>
        </div>
      </form>
    </div>
  );
}
