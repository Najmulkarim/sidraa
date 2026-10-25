'use client';

import Link from 'next/link';
import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { placeOrder, type CheckoutState } from '@/actions/shop';
import { describeStockProblem } from '@/lib/db-errors';
import { toOrderItems } from '@/lib/cart';
import { trackPixel } from '@/lib/facebook/pixel';
import { formatTaka, toNumber } from '@/lib/format';
import type { PaymentOptions } from '@/lib/payments/settings';
import type { DeliveryZone } from '@/lib/types';
import { useCart } from './CartProvider';
import { lineProblem, useQuote } from './CartView';
import { defaultChoice, PaymentPicker, type PayChoice } from './PaymentPicker';

const initial: CheckoutState = { ok: false };

function Field({
  name, label, error, children, hint,
}: { name: string; label: string; error?: string; children: ReactNode; hint?: string }) {
  return (
    <div className="field">
      <label htmlFor={name} className="label">{label}</label>
      {children}
      {hint && !error && <p className="hint">{hint}</p>}
      {error && <p id={`${name}-error`} className="error">{error}</p>}
    </div>
  );
}

export function CheckoutForm({ zones, codTerms, returnDays, couponsEnabled = true, payments }: { zones: DeliveryZone[]; codTerms: string; returnDays: number; couponsEnabled?: boolean; payments: PaymentOptions }) {
  const { lines, ready } = useCart();
  const [state, action, submitting] = useActionState(placeOrder, initial);
  const [zoneId, setZoneId] = useState<string>(state.values?.zoneId || zones[0]?.id || '');
  // One key per checkout attempt: a double click or a network retry
  // returns the same order instead of creating a second one.
  const [idempotencyKey, setKey] = useState('');
  useEffect(() => setKey(crypto.randomUUID()), []);
  const [couponInput, setCouponInput] = useState(state.values?.couponCode ?? '');
  const [coupon, setCoupon] = useState<string | null>(state.values?.couponCode || null);
  const { quote, error: quoteError, pending: quoting } = useQuote(zoneId || null, state.stock ? JSON.stringify(state.stock) : '', coupon);
  const couponError = coupon && quote?.coupon?.error ? quote.coupon.error : null;
  const [pay, setPay] = useState<PayChoice>(() => {
    const m = state.values?.paymentMethod;
    return m === 'bkash' || m === 'nagad' ? { method: m, mode: state.values?.paymentMode === 'manual' ? 'manual' : 'merchant' } : defaultChoice(payments);
  });
  const cod = pay.method === 'cod';

  // Facebook Pixel: InitiateCheckout once per visit to this page.
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current || !quote || quote.lines.length === 0) return;
    sent.current = true;
    const ok = quote.lines.filter((l) => l.state === 'ok');
    trackPixel('InitiateCheckout', {
      value: quote.subtotal - (quote.discount ?? 0),
      num_items: ok.reduce((n, l) => n + l.quantity, 0),
      content_type: 'product',
      content_ids: ok.map((l) => ('product_id' in l ? l.product_id : l.variant_id)),
      contents: ok.map((l) => ({ id: 'product_id' in l ? l.product_id : l.variant_id, quantity: l.quantity, item_price: 'unit_price' in l ? l.unit_price : 0 })),
    });
  }, [quote]);

  // A <section> (not the empty-cart <div>) so React swaps the node instead of moving it: no layout shift.
  if (!ready) return <section className="card min-h-60 animate-pulse bg-soft" aria-busy="true"><span className="sr-only">Loading your cart…</span></section>;
  if (lines.length === 0) {
    return (
      <div className="card grid min-h-60 place-content-center justify-items-center p-10 text-center">
        <p className="font-display text-3xl">Your cart is empty</p>
        <Link href="/products" className="btn btn-primary mt-6">Start shopping</Link>
      </div>
    );
  }

  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};
  const problems = (quote?.lines ?? []).filter((l) => l.state !== 'ok');
  const canSubmit = !!idempotencyKey && !!quote && problems.length === 0 && !quoting && !submitting && !!zoneId && !couponError;
  const err = (name: string) => (fe[name] ? { 'aria-invalid': true as const, 'aria-describedby': `${name}-error` } : {});

  return (
    <form
      onSubmit={(e: FormEvent<HTMLFormElement>) => {
        // Submitting this way (not <form action>) keeps what the customer
        // typed if the server sends the form back with an error.
        e.preventDefault();
        if (!canSubmit) return;
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="grid gap-8 lg:grid-cols-[1fr_24rem]"
      noValidate
    >
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input type="hidden" name="items" value={JSON.stringify(toOrderItems(lines))} />
      <input type="hidden" name="couponCode" value={coupon && !couponError ? coupon : ''} />

      <div className="space-y-8">
        {state.message && !state.ok && (
          <div className="rounded-2xl border border-bad/30 bg-bad/5 p-4 text-sm text-bad" role="alert">
            <p className="font-semibold">{state.message}</p>
            {state.stock && state.stock.length > 1 && (
              <ul className="mt-2 list-disc pl-5">
                {state.stock.map((p) => <li key={p.variant_id}>{describeStockProblem(p)}</li>)}
              </ul>
            )}
            {state.stock && <p className="mt-2"><Link href="/cart" className="underline">Update your cart</Link></p>}
          </div>
        )}

        <section className="card space-y-5 p-5 sm:p-6">
          <h2 className="font-display text-2xl font-semibold">Your details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="customerName" label="Full name" error={fe.customerName}>
              <input id="customerName" name="customerName" autoComplete="name" required maxLength={80} defaultValue={v.customerName} className="input" {...err('customerName')} />
            </Field>
            <Field name="customerPhone" label="Mobile number" error={fe.customerPhone} hint="The rider will call this number.">
              <input id="customerPhone" name="customerPhone" type="tel" inputMode="tel" autoComplete="tel" required maxLength={20} placeholder="01XXXXXXXXX" defaultValue={v.customerPhone} className="input" {...err('customerPhone')} />
            </Field>
          </div>
          <Field name="address" label="Full address" error={fe.address} hint="House, road, block or village.">
            <textarea id="address" name="address" autoComplete="street-address" required maxLength={300} rows={3} defaultValue={v.address} className="input" {...err('address')} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="district" label="District" error={fe.district}>
              <input id="district" name="district" autoComplete="address-level1" required maxLength={60} placeholder="e.g. Dhaka" defaultValue={v.district} className="input" {...err('district')} />
            </Field>
            <Field name="area" label="Area / thana (optional)" error={fe.area}>
              <input id="area" name="area" autoComplete="address-level2" maxLength={60} placeholder="e.g. Mirpur" defaultValue={v.area} className="input" {...err('area')} />
            </Field>
          </div>
        </section>

        <section className="card space-y-4 p-5 sm:p-6">
          <h2 className="font-display text-2xl font-semibold">Delivery area</h2>
          <fieldset className="grid gap-3" aria-describedby={fe.zoneId ? 'zoneId-error' : undefined}>
            <legend className="sr-only">Delivery area</legend>
            {zones.map((z) => (
              <label key={z.id} className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 ${zoneId === z.id ? 'border-brand bg-brand/5' : 'border-line'}`}>
                <input type="radio" name="zoneId" value={z.id} checked={zoneId === z.id} onChange={() => setZoneId(z.id)} className="h-4 w-4 accent-[var(--brand)]" />
                <span className="flex-1">
                  <span className="block font-semibold">{z.name}</span>
                  <span className="block text-sm text-muted">
                    {z.eta_text ?? ''}
                    {z.free_over !== null ? `${z.eta_text ? ' · ' : ''}Free over ${formatTaka(z.free_over)}` : ''}
                  </span>
                </span>
                <span className="font-semibold">{formatTaka(toNumber(z.charge))}</span>
              </label>
            ))}
          </fieldset>
          {fe.zoneId && <p id="zoneId-error" className="error">{fe.zoneId}</p>}
          <Field name="note" label="Note for us (optional)" error={fe.note}>
            <textarea id="note" name="note" maxLength={500} rows={2} placeholder="Landmark, best time to call…" defaultValue={v.note} className="input" />
          </Field>
        </section>

        <PaymentPicker options={payments} choice={pay} onChange={setPay} total={quote?.total ?? null} errors={fe} values={v} />
      </div>

      <aside className="card h-fit space-y-5 p-5 sm:p-6 lg:sticky lg:top-24">
        <h2 className="font-display text-2xl font-semibold">Order summary</h2>
        <ul className="space-y-3 text-sm">
          {(quote?.lines ?? []).map((l) => (
            <li key={l.variant_id} className="flex justify-between gap-3">
              <span>
                {l.state === 'unavailable' ? 'Unavailable item' : l.product_name}
                {l.state !== 'unavailable' && l.variant_label ? <span className="text-muted"> · {l.variant_label}</span> : null}
                <span className="text-muted"> × {l.quantity}</span>
                {lineProblem(l) && <span className="block error">{lineProblem(l)}</span>}
              </span>
              <span className="shrink-0">{l.state === 'ok' ? formatTaka(l.line_total) : '—'}</span>
            </li>
          ))}
        </ul>
        {couponsEnabled && (
          <div className="space-y-1.5 border-t border-line pt-4">
            <label htmlFor="coupon" className="label">Coupon code</label>
            <div className="flex gap-2">
              <input
                id="coupon"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    setCoupon(couponInput.trim() || null);
                  }
                }}
                maxLength={24}
                autoComplete="off"
                className="input min-h-10 font-mono uppercase"
                placeholder="Optional"
              />
              {coupon ? (
                <button type="button" className="btn btn-outline btn-sm min-h-10" onClick={() => { setCoupon(null); setCouponInput(''); }}>Remove</button>
              ) : (
                <button type="button" className="btn btn-outline btn-sm min-h-10" disabled={!couponInput.trim()} onClick={() => setCoupon(couponInput.trim())}>Apply</button>
              )}
            </div>
            {couponError && <p className="error" role="alert">{couponError}</p>}
            {fe.couponCode && !couponError && <p className="error" role="alert">{fe.couponCode}</p>}
            {coupon && !couponError && quote?.coupon && <p className="text-[13px] font-semibold text-ok">{quote.coupon.code} applied — you save {formatTaka(quote.discount)}</p>}
          </div>
        )}
        <dl className="space-y-2 border-t border-line pt-4 text-sm">
          <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{quote ? formatTaka(quote.subtotal) : '…'}</dd></div>
          {quote && quote.discount > 0 && <div className="flex justify-between text-ok"><dt>Discount</dt><dd>− {formatTaka(quote.discount)}</dd></div>}
          <div className="flex justify-between">
            <dt className="text-muted">Delivery</dt>
            <dd>{quote?.delivery_charge == null ? '…' : quote.delivery_charge === 0 ? 'Free' : formatTaka(quote.delivery_charge)}</dd>
          </div>
          <div className="flex justify-between text-base font-semibold">
            <dt>{cod ? 'Total to pay on delivery' : 'Total to pay now'}</dt>
            <dd>{quote?.total == null ? '…' : formatTaka(quote.total)}</dd>
          </div>
        </dl>

        {cod && <div className="rounded-2xl bg-accent/10 p-4 text-sm">
          <p className="font-semibold">Cash on delivery</p>
          <p className="mt-1 text-ink/80">{codTerms}</p>
          <p className="mt-1 text-ink/80">Returns accepted within {returnDays} day{returnDays === 1 ? '' : 's'} of delivery.</p>
        </div>}

        {quoteError && <p className="error" role="alert">{quoteError}</p>}
        {problems.length > 0 && <p className="error">Some items need attention. <Link href="/cart" className="underline">Fix in cart</Link></p>}

        <button type="submit" className="btn btn-primary w-full" disabled={!canSubmit} aria-busy={submitting}>
          {submitting ? 'Placing your order…' : `${!cod && pay.mode === 'merchant' ? 'Place order & pay' : 'Place order'}${quote?.total != null ? ` · ${formatTaka(quote.total)}` : ''}`}
        </button>
        <p className="text-center text-xs text-muted">{cod ? 'No payment now. You pay the rider when the parcel arrives.' : pay.mode === 'merchant' ? 'You will pay on the secure payment page next.' : 'We confirm your order after checking the payment.'}</p>
      </aside>
    </form>
  );
}
