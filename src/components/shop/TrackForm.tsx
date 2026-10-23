'use client';

import { useActionState } from 'react';
import { trackOrder, type TrackState } from '@/actions/shop';
import { formatDateTime, formatTaka } from '@/lib/format';
import { StatusSteps } from './StatusSteps';

const initial: TrackState = { ok: false };

export function TrackForm({ defaultRef = '' }: { defaultRef?: string }) {
  const [state, action, pending] = useActionState(trackOrder, initial);
  const fe = state.fieldErrors ?? {};
  const r = state.result;

  return (
    <div className="space-y-8">
      <form action={action} className="card grid gap-4 p-5 sm:grid-cols-[1fr_12rem_auto] sm:items-start sm:p-6" noValidate>
        <div className="field">
          <label htmlFor="ref" className="label">Order reference</label>
          <input id="ref" name="ref" required maxLength={20} autoCapitalize="characters" placeholder="SD-7K2M-9QXA" defaultValue={state.values?.ref ?? defaultRef} className="input font-mono uppercase" aria-invalid={!!fe.ref} />
          {fe.ref && <p className="error">{fe.ref}</p>}
        </div>
        <div className="field">
          <label htmlFor="phoneLast4" className="label">Last 4 digits of phone</label>
          <input id="phoneLast4" name="phoneLast4" required inputMode="numeric" maxLength={4} pattern="\d{4}" placeholder="1234" defaultValue={state.values?.phoneLast4} className="input" aria-invalid={!!fe.phoneLast4} />
          {fe.phoneLast4 && <p className="error">{fe.phoneLast4}</p>}
        </div>
        <button className="btn btn-primary sm:mt-[1.6rem]" disabled={pending}>{pending ? 'Checking…' : 'Track'}</button>
      </form>

      {state.message && !state.ok && <p className="card p-4 text-sm text-bad" role="alert">{state.message}</p>}

      {r && (
        <section className="card space-y-6 p-5 sm:p-8" aria-live="polite">
          <header className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-mono text-xl font-bold text-brand">{r.public_ref}</h2>
            <p className="text-sm text-muted">Placed {formatDateTime(r.placed_at)}</p>
          </header>
          <StatusSteps status={r.status} />
          <ul className="divide-y divide-line text-sm">
            {r.items.map((i, idx) => (
              <li key={idx} className="flex justify-between gap-4 py-2">
                <span>{i.product_name}{i.variant_label && <span className="text-muted"> · {i.variant_label}</span>}<span className="text-muted"> × {i.quantity}</span></span>
                <span>{formatTaka(i.line_total)}</span>
              </li>
            ))}
          </ul>
          <p className="flex justify-between border-t border-line pt-3 font-semibold">
            <span>Total ({r.zone_name})</span>
            <span>{formatTaka(r.total)}</span>
          </p>
        </section>
      )}
    </div>
  );
}
