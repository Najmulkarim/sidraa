import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { ClearCart } from '@/components/shop/ClearCart';
import { StatusSteps } from '@/components/shop/StatusSteps';
import { TrackPurchase } from '@/components/shop/TrackPurchase';
import { getSettings } from '@/lib/catalog';
import { LAST_ORDER_COOKIE } from '@/lib/cart';
import { formatDateTime, formatTaka } from '@/lib/format';
import { canonicalRef } from '@/lib/order-ref';
import { maskBdPhone } from '@/lib/phone';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Order, OrderItem } from '@/lib/types';

export const metadata: Metadata = { title: 'Order received', robots: { index: false } };

/**
 * Confirmation page. Full details are shown only to the browser that
 * placed the order (httpOnly cookie set by the checkout action). Anyone
 * else with the link sees the reference and a pointer to tracking, which
 * needs the phone digits.
 */
const WALLET = { bkash: 'bKash', nagad: 'Nagad' } as const;

export default async function OrderPage({ params, searchParams }: { params: Promise<{ ref: string }>; searchParams: Promise<{ pay?: string }> }) {
  const { pay } = await searchParams;
  const { ref: rawRef } = await params;
  const ref = canonicalRef(decodeURIComponent(rawRef));
  const [jar, settings] = await Promise.all([cookies(), getSettings()]);
  const isOwner = !!ref && jar.get(LAST_ORDER_COOKIE)?.value === ref;

  let order: (Order & { items: OrderItem[] }) | null = null;
  if (isOwner) {
    const { data } = await createAdminClient()
      .from('orders')
      .select('*, items:order_items(id, product_id, variant_id, product_name, sku, variant_label, unit_price, quantity, line_total)')
      .eq('public_ref', ref)
      .maybeSingle();
    order = data as (Order & { items: OrderItem[] }) | null;
  }

  if (!order) {
    return (
      <div className="container-page max-w-2xl py-16 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-ok/10 text-ok" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m5 12 5 5 9-10" /></svg>
        </span>
        <h1 className="mt-4 font-display text-4xl font-semibold">Thank you for shopping with {settings.store_name}!</h1>
        {ref && (
          <p className="mt-5 inline-flex flex-col items-center rounded-2xl border border-dashed border-brand/40 px-6 py-3">
            <span className="eyebrow">Order number</span>
            <span className="font-mono text-2xl font-bold tracking-wider text-brand">{ref}</span>
          </p>
        )}
        <p className="mt-4 text-muted">To see the status of this order, use order tracking with the order number and the last 4 digits of the phone number used.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/products" className="btn btn-primary">Continue shopping</Link>
          <Link href="/track" className="btn btn-outline">Track order</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page max-w-3xl py-12">
      <ClearCart />
      {settings.fb_pixel_id && (
        <TrackPurchase
          orderRef={order.public_ref}
          value={Number(order.total)}
          contents={order.items.filter((i) => i.product_id).map((i) => ({ id: i.product_id as string, quantity: i.quantity, item_price: Number(i.unit_price) }))}
        />
      )}
      <div className="card space-y-8 p-6 sm:p-10">
        <header className="space-y-3 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-ok/10 text-ok" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m5 12 5 5 9-10" /></svg>
          </span>
          <h1 className="font-display text-4xl font-semibold">Thank you for your order, {order.customer_name.split(' ')[0]}!</h1>
          <p className="text-muted">Your order has been placed successfully. We will call {maskBdPhone(order.customer_phone)} to confirm it.</p>
          <p className="inline-flex flex-col items-center rounded-2xl border border-dashed border-brand/40 px-6 py-3">
            <span className="eyebrow">Order number</span>
            <span className="font-mono text-2xl font-bold tracking-wider text-brand">{order.public_ref}</span>
            <span className="text-xs text-muted">Save this to track your order.</span>
          </p>
        </header>

        {order.payment_method !== 'cod' && (() => {
          const wallet = WALLET[order.payment_method];
          if (order.payment_status === 'paid') {
            return <p className="rounded-2xl bg-ok/10 p-4 text-center text-sm font-semibold text-ok">Paid {formatTaka(order.total)} by {wallet}{order.payment_trx_id ? ` · TrxID ${order.payment_trx_id}` : ''}. Thank you!</p>;
          }
          if (order.payment_mode === 'manual') {
            return <p className="rounded-2xl bg-soft p-4 text-center text-sm">We received your {wallet} Transaction ID <b className="font-mono">{order.payment_trx_id}</b>. We will check the payment and call you to confirm.</p>;
          }
          return (
            <div className="space-y-3 rounded-2xl border border-bad/30 bg-bad/5 p-4 text-center text-sm">
              <p className="font-semibold text-bad">{pay === 'cancelled' ? 'You cancelled the payment.' : 'The payment was not completed.'} Your order is saved.</p>
              <p className="text-ink/75">Try {wallet} again, or simply pay the rider in cash when the parcel arrives.</p>
              <a href={`/order/${order.public_ref}/pay`} className="btn btn-primary">Pay with {wallet} again</a>
            </div>
          );
        })()}

        <StatusSteps status={order.status} />

        <section>
          <h2 className="mb-3 font-semibold">Items</h2>
          <ul className="divide-y divide-line text-sm">
            {order.items.map((i) => (
              <li key={i.id} className="flex justify-between gap-4 py-2">
                <span>
                  {i.product_name}
                  {i.variant_label && <span className="text-muted"> · {i.variant_label}</span>}
                  <span className="text-muted"> × {i.quantity}</span>
                </span>
                <span>{formatTaka(i.line_total)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{formatTaka(order.subtotal)}</dd></div>
            {Number(order.discount) > 0 && <div className="flex justify-between text-ok"><dt>Discount{order.coupon_code ? ` (${order.coupon_code})` : ''}</dt><dd>− {formatTaka(order.discount)}</dd></div>}
            <div className="flex justify-between"><dt className="text-muted">Delivery ({order.zone_name})</dt><dd>{Number(order.delivery_charge) === 0 ? 'Free' : formatTaka(order.delivery_charge)}</dd></div>
            <div className="flex justify-between text-base font-semibold"><dt>{order.payment_status === 'paid' ? 'Paid' : order.payment_method === 'cod' || order.payment_status === 'failed' ? 'Pay on delivery' : 'To pay'}</dt><dd>{formatTaka(order.total)}</dd></div>
          </dl>
        </section>

        <section className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <h2 className="mb-1 font-semibold">Delivering to</h2>
            <p className="text-muted">
              {order.customer_name}<br />
              {order.address}<br />
              {[order.area, order.district].filter(Boolean).join(', ')}
            </p>
          </div>
          <div>
            <h2 className="mb-1 font-semibold">Placed</h2>
            <p className="text-muted">{formatDateTime(order.created_at)}</p>
          </div>
        </section>

        {order.payment_status !== 'paid' && <div className="rounded-2xl bg-accent/10 p-4 text-sm">{settings.cod_terms}</div>}

        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/products" className="btn btn-primary">Continue shopping</Link>
          <Link href="/track" className="btn btn-outline">Track order</Link>
        </div>
      </div>
    </div>
  );
}
