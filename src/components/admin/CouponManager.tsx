'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { deleteCoupon, saveCoupon } from '@/actions/admin-customers';
import { formatTaka } from '@/lib/format';
import type { ActionState } from '@/lib/types';
import { FieldError, FormMessage, PendingButton, useKeepValuesAction } from './ui';

export type Coupon = {
  code: string; kind: 'percent' | 'fixed'; value: number | string; min_subtotal: number | string; max_discount: number | string | null;
  starts_at: string | null; ends_at: string | null; usage_limit: number | null; used_count: number; is_active: boolean;
};

/** ISO → yyyy-mm-dd in Dhaka time (end dates are stored as the next midnight). */
const ymd = (iso: string | null, minusDay = false) => {
  if (!iso) return '';
  const d = new Date(new Date(iso).getTime() + 6 * 3_600_000 - (minusDay ? 86_400_000 : 0));
  return d.toISOString().slice(0, 10);
};

function CouponForm({ coupon }: { coupon?: Coupon }) {
  const { state, onSubmit, pending } = useKeepValuesAction(saveCoupon);
  const [kind, setKind] = useState<'percent' | 'fixed'>(coupon?.kind ?? 'percent');
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && !coupon) ref.current?.reset();
  }, [state, coupon]);
  const id = coupon?.code ?? 'new';
  return (
    <form ref={ref} onSubmit={onSubmit} className="grid gap-3 md:grid-cols-[9rem_8rem_6rem_7rem_7rem_9rem_9rem_6rem_auto_auto] md:items-end" noValidate>
      {coupon && <input type="hidden" name="existing" value="on" />}
      <div className="field">
        <label className="label" htmlFor={`cc-${id}`}>Code</label>
        <input id={`cc-${id}`} name="code" defaultValue={coupon?.code} readOnly={!!coupon} maxLength={24} className={`input font-mono uppercase ${coupon ? 'bg-soft' : ''}`} placeholder="EID10" />
        <FieldError state={state} name="code" />
      </div>
      <div className="field">
        <label className="label" htmlFor={`ck-${id}`}>Type</label>
        <select id={`ck-${id}`} name="kind" value={kind} onChange={(e) => setKind(e.target.value as 'percent' | 'fixed')} className="input">
          <option value="percent">% off</option>
          <option value="fixed">৳ off</option>
        </select>
      </div>
      <div className="field">
        <label className="label" htmlFor={`cv-${id}`}>{kind === 'percent' ? '%' : '৳'}</label>
        <input id={`cv-${id}`} name="value" inputMode="decimal" defaultValue={coupon ? String(coupon.value) : ''} className="input" />
        <FieldError state={state} name="value" />
      </div>
      <div className="field">
        <label className="label" htmlFor={`cm-${id}`}>Min. order ৳</label>
        <input id={`cm-${id}`} name="minSubtotal" inputMode="decimal" defaultValue={coupon ? String(coupon.min_subtotal) : ''} placeholder="0" className="input" />
      </div>
      <div className="field">
        <label className="label" htmlFor={`cx-${id}`}>Max off ৳</label>
        <input id={`cx-${id}`} name="maxDiscount" inputMode="decimal" disabled={kind !== 'percent'} defaultValue={coupon?.max_discount == null ? '' : String(coupon.max_discount)} placeholder="no cap" className="input disabled:bg-soft" />
      </div>
      <div className="field">
        <label className="label" htmlFor={`cs-${id}`}>Starts</label>
        <input id={`cs-${id}`} name="startsAt" type="date" defaultValue={ymd(coupon?.starts_at ?? null)} className="input" />
      </div>
      <div className="field">
        <label className="label" htmlFor={`ce-${id}`}>Ends (incl.)</label>
        <input id={`ce-${id}`} name="endsAt" type="date" defaultValue={ymd(coupon?.ends_at ?? null, true)} className="input" />
        <FieldError state={state} name="endsAt" />
      </div>
      <div className="field">
        <label className="label" htmlFor={`cl-${id}`}>Uses</label>
        <input id={`cl-${id}`} name="usageLimit" inputMode="numeric" defaultValue={coupon?.usage_limit ?? ''} placeholder="∞" className="input" />
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={coupon?.is_active ?? true} className="h-4 w-4 accent-[var(--brand)]" /> On
      </label>
      <PendingButton pending={pending} className="btn btn-primary btn-sm">{coupon ? 'Save' : 'Create'}</PendingButton>
      <div className="md:col-span-10"><FormMessage state={state} /></div>
    </form>
  );
}

export function CouponManager({ coupons }: { coupons: Coupon[] }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<ActionState | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  return (
    <div className="space-y-6">
      <section className="card p-5">
        <h2 className="mb-1 font-semibold">New coupon</h2>
        <p className="mb-3 text-sm text-muted">Customers type the code at checkout. The server checks it and works out the discount; a used-up or expired code is refused.</p>
        <CouponForm />
      </section>
      {msg && <FormMessage state={msg} />}
      <section className="card divide-y divide-line p-5">
        <h2 className="pb-3 font-semibold">Coupons</h2>
        {coupons.length === 0 && <p className="py-4 text-sm text-muted">No coupons yet.</p>}
        {coupons.map((c) => (
          <div key={c.code} className="space-y-2 py-4">
            <p className="flex flex-wrap items-center gap-2 text-[13px]">
              <span className="font-mono text-base font-bold">{c.code}</span>
              <span className="badge badge-brand">{c.kind === 'percent' ? `${Number(c.value)}% off` : `${formatTaka(c.value)} off`}</span>
              <span className="text-muted">Used {c.used_count}{c.usage_limit ? ` of ${c.usage_limit}` : ''} times</span>
              {!c.is_active && <span className="badge">Off</span>}
              <button
                type="button"
                className={`ml-auto text-[12px] underline ${armed === c.code ? 'font-bold text-bad' : 'text-bad'}`}
                disabled={busy}
                onClick={() => {
                  if (armed !== c.code) return setArmed(c.code);
                  start(async () => { setMsg(await deleteCoupon(c.code)); setArmed(null); router.refresh(); });
                }}
              >
                {armed === c.code ? 'Click again to delete' : 'Delete'}
              </button>
            </p>
            <CouponForm coupon={c} />
          </div>
        ))}
      </section>
    </div>
  );
}
