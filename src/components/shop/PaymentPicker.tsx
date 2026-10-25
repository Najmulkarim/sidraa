'use client';

import { useState } from 'react';
import { formatTaka } from '@/lib/format';
import type { PaymentOptions } from '@/lib/payments/settings';

export type PayChoice = { method: 'cod' | 'bkash' | 'nagad'; mode: 'manual' | 'merchant' | null };

const NAME = { bkash: 'bKash', nagad: 'Nagad' } as const;
const COLOR = { bkash: 'bg-[#e2136e]', nagad: 'bg-[#f6921e]' } as const;
const TYPE_LABEL: Record<string, string> = { personal: 'Personal', agent: 'Agent', merchant: 'Merchant' };

/** First option the shop offers: cash on delivery if on, else the first online one. */
export function defaultChoice(o: PaymentOptions): PayChoice {
  if (o.cod) return { method: 'cod', mode: null };
  for (const m of ['bkash', 'nagad'] as const) {
    if (o[m].merchant) return { method: m, mode: 'merchant' };
    if (o[m].manual) return { method: m, mode: 'manual' };
  }
  return { method: 'cod', mode: null };
}

/**
 * Payment section of checkout: cash on delivery, bKash or Nagad; for an
 * online wallet either the automatic gateway or a manual Send Money with
 * the Transaction ID. Posts paymentMethod / paymentMode / paymentSender / paymentTrxId.
 */
export function PaymentPicker({ options, choice, onChange, total, errors, values }: {
  options: PaymentOptions; choice: PayChoice; onChange: (c: PayChoice) => void; total: number | null;
  errors: Record<string, string | undefined>; values: Record<string, string | undefined>;
}) {
  const [copied, setCopied] = useState(false);
  const wallets = (['bkash', 'nagad'] as const).filter((m) => options[m].merchant || options[m].manual);
  const tile = (active: boolean) => `flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition active:scale-[0.99] ${active ? 'border-brand bg-brand/5' : 'border-line'}`;

  const pick = (method: PayChoice['method']) => {
    if (method === 'cod') return onChange({ method, mode: null });
    onChange({ method, mode: options[method].merchant ? 'merchant' : 'manual' });
  };
  const manual = choice.method !== 'cod' && choice.mode === 'manual' ? options[choice.method].manual : null;

  return (
    <section className="card space-y-4 p-5 sm:p-6">
      <h2 className="font-display text-2xl font-semibold">Payment</h2>
      <input type="hidden" name="paymentMethod" value={choice.method} />
      <input type="hidden" name="paymentMode" value={choice.mode ?? ''} />

      <div className="grid gap-3">
        {options.cod && (
          <label className={tile(choice.method === 'cod')}>
            <input type="radio" name="payPick" checked={choice.method === 'cod'} onChange={() => pick('cod')} className="h-4 w-4 accent-[var(--brand)]" />
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-night text-[13px] font-bold text-white">৳</span>
            <span><b className="block text-[15px]">Cash on delivery</b><span className="text-[13px] text-muted">Pay the rider when the parcel arrives</span></span>
          </label>
        )}
        {wallets.map((m) => (
          <label key={m} className={tile(choice.method === m)}>
            <input type="radio" name="payPick" checked={choice.method === m} onChange={() => pick(m)} className="h-4 w-4 accent-[var(--brand)]" />
            <span className={`grid h-9 w-9 place-items-center rounded-lg text-[11px] font-extrabold text-white ${COLOR[m]}`}>{NAME[m]}</span>
            <span><b className="block text-[15px]">{NAME[m]}</b><span className="text-[13px] text-muted">Pay now from your {NAME[m]} account</span></span>
          </label>
        ))}
      </div>
      {errors.paymentMethod && <p className="error" role="alert">{errors.paymentMethod}</p>}

      {choice.method !== 'cod' && options[choice.method].merchant && options[choice.method].manual && (
        <div className="flex gap-2 rounded-xl bg-soft p-1 text-[13.5px] font-semibold" role="radiogroup" aria-label="How to pay">
          {(['merchant', 'manual'] as const).map((mode) => (
            <button key={mode} type="button" role="radio" aria-checked={choice.mode === mode} onClick={() => onChange({ ...choice, mode })} className={`flex-1 rounded-lg px-3 py-2 transition ${choice.mode === mode ? 'bg-card text-night shadow' : 'text-muted'}`}>
              {mode === 'merchant' ? `Pay with ${NAME[choice.method as 'bkash']} (automatic)` : 'Send Money (manual)'}
            </button>
          ))}
        </div>
      )}

      {choice.method !== 'cod' && choice.mode === 'merchant' && (
        <p className="rounded-xl bg-soft p-4 text-[14px]">
          After you place the order you will go to the {NAME[choice.method]} page to pay <b>{total == null ? 'the total' : formatTaka(total)}</b>. Your order is confirmed once the payment is complete.
        </p>
      )}

      {manual && choice.method !== 'cod' && (
        <div className="space-y-4 rounded-xl border border-dashed border-brand/40 p-4">
          <ol className="list-decimal space-y-1.5 pl-5 text-[14px]">
            <li>Open your {NAME[choice.method]} app and choose <b>{manual.type === 'personal' ? 'Send Money' : manual.type === 'agent' ? 'Cash Out' : 'Payment'}</b>.</li>
            <li>
              Send <b>{total == null ? 'the total' : formatTaka(total)}</b> to{' '}
              <button type="button" onClick={() => { navigator.clipboard?.writeText(manual.number).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {}); }} className="font-mono font-bold text-brand underline decoration-dotted">
                {manual.number}
              </button>{' '}
              <span className="text-muted">({TYPE_LABEL[manual.type] ?? manual.type}{copied ? ' · copied' : ' · tap to copy'})</span>
            </li>
            <li>Enter the number you sent from and the Transaction ID (TrxID) from the SMS below.</li>
          </ol>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="field">
              <label htmlFor="paymentSender" className="label">Your {NAME[choice.method]} number</label>
              <input id="paymentSender" name="paymentSender" type="tel" inputMode="tel" required maxLength={20} placeholder="01XXXXXXXXX" defaultValue={values.paymentSender} className="input" aria-invalid={!!errors.paymentSender} />
              {errors.paymentSender && <p className="error">{errors.paymentSender}</p>}
            </div>
            <div className="field">
              <label htmlFor="paymentTrxId" className="label">Transaction ID (TrxID)</label>
              <input id="paymentTrxId" name="paymentTrxId" required maxLength={30} autoComplete="off" placeholder="e.g. 9JK7A2B3CD" defaultValue={values.paymentTrxId} className="input font-mono uppercase" aria-invalid={!!errors.paymentTrxId} />
              {errors.paymentTrxId && <p className="error">{errors.paymentTrxId}</p>}
            </div>
          </div>
          <p className="text-[12.5px] text-muted">We check the payment and confirm your order by phone.</p>
        </div>
      )}
    </section>
  );
}
