'use client';

import { useEffect, useRef } from 'react';
import { saveZone } from '@/actions/admin-settings';
import type { DeliveryZone } from '@/lib/types';
import { FieldError, FormMessage, PendingButton, useKeepValuesAction } from './ui';

export function ZoneForm({ zone }: { zone?: DeliveryZone }) {
  const { state, onSubmit, pending } = useKeepValuesAction(saveZone);
  const id = zone?.id ?? 'new';
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && !zone) formRef.current?.reset();
  }, [state, zone]);
  return (
    <form ref={formRef} onSubmit={onSubmit} className="grid gap-3 md:grid-cols-[1.3fr_7rem_8rem_1fr_5rem_auto_auto] md:items-end" noValidate>
      {zone && <input type="hidden" name="id" value={zone.id} />}
      <div className="field">
        <label className="label" htmlFor={`zn-${id}`}>Area name</label>
        <input id={`zn-${id}`} name="name" defaultValue={zone?.name} maxLength={60} className="input" />
        <FieldError state={state} name="name" />
      </div>
      <div className="field">
        <label className="label" htmlFor={`zc-${id}`}>Charge ৳</label>
        <input id={`zc-${id}`} name="charge" inputMode="decimal" defaultValue={zone ? String(zone.charge) : ''} className="input" />
        <FieldError state={state} name="charge" />
      </div>
      <div className="field">
        <label className="label" htmlFor={`zf-${id}`}>Free over ৳</label>
        <input id={`zf-${id}`} name="freeOver" inputMode="decimal" placeholder="never" defaultValue={zone?.free_over == null ? '' : String(zone.free_over)} className="input" />
        <FieldError state={state} name="freeOver" />
      </div>
      <div className="field">
        <label className="label" htmlFor={`ze-${id}`}>Delivery time</label>
        <input id={`ze-${id}`} name="etaText" defaultValue={zone?.eta_text ?? ''} maxLength={60} placeholder="e.g. 1–2 days" className="input" />
      </div>
      <div className="field">
        <label className="label" htmlFor={`zs-${id}`}>Order</label>
        <input id={`zs-${id}`} name="sortOrder" type="number" defaultValue={zone?.sort_order ?? 0} className="input" />
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={zone?.is_active ?? true} className="h-4 w-4 accent-[var(--brand)]" />
        Active
      </label>
      <PendingButton pending={pending} className="btn btn-primary btn-sm">{zone ? 'Save' : 'Add'}</PendingButton>
      <div className="md:col-span-7"><FormMessage state={state} /></div>
    </form>
  );
}
