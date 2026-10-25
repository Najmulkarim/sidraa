'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { quoteCart } from '@/actions/shop';
import { toOrderItems } from '@/lib/cart';
import { formatTaka } from '@/lib/format';
import type { Quote, QuoteLine } from '@/lib/types';
import { useCart } from './CartProvider';
import { ProductImage } from './ProductImage';

/** Fetches a server quote whenever the cart, the zone or `refresh` changes. */
export function useQuote(zoneId: string | null, refresh = '', coupon: string | null = null) {
  const { lines, ready } = useCart();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const key = useMemo(() => JSON.stringify(toOrderItems(lines)), [lines]);

  useEffect(() => {
    if (!ready) return;
    const items = JSON.parse(key) as ReturnType<typeof toOrderItems>;
    if (items.length === 0) {
      setQuote(null);
      return;
    }
    let cancelled = false;
    startTransition(async () => {
      const res = await quoteCart(items, zoneId, coupon);
      if (cancelled) return;
      if (res.ok) {
        setQuote(res.quote);
        setError(null);
      } else setError(res.message);
    });
    return () => {
      cancelled = true;
    };
  }, [key, zoneId, ready, refresh, coupon]);

  return { quote, error, pending };
}

export function lineProblem(l: QuoteLine): string | null {
  if (l.state === 'unavailable') return 'No longer available — please remove it.';
  if (l.state === 'sold_out') return 'Sold out — please remove it.';
  if (l.state === 'insufficient') return `Only ${l.stock_left} left.`;
  return null;
}

export function CartView() {
  const { lines, ready, dispatch } = useCart();
  const { quote, error, pending } = useQuote(null);

  // A <section> (not the empty-cart <div>) so React swaps the node instead of moving it: no layout shift.
  if (!ready) return <section className="card min-h-60 animate-pulse bg-soft" aria-busy="true"><span className="sr-only">Loading your cart…</span></section>;

  if (lines.length === 0) {
    return (
      <div className="card grid min-h-60 place-content-center justify-items-center p-10 text-center">
        <p className="font-display text-3xl">Your cart is empty</p>
        <p className="mt-2 text-muted">Find something you love and it will wait for you here.</p>
        <Link href="/products" className="btn btn-primary mt-6">Start shopping</Link>
      </div>
    );
  }

  const byId = new Map((quote?.lines ?? []).map((l) => [l.variant_id, l]));
  const hasProblem = (quote?.lines ?? []).some((l) => l.state !== 'ok');

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <ul className="card divide-y divide-line">
        {lines.map((line) => {
          const q = byId.get(line.variantId);
          const priced = q && q.state !== 'unavailable' ? q : null;
          const problem = q ? lineProblem(q) : null;
          return (
            <li key={line.variantId} className="flex gap-4 p-4">
              <div className="relative h-28 w-21 shrink-0 overflow-hidden rounded-xl">
                <ProductImage path={line.imagePath} alt={line.productName ?? 'Product'} sizes="84px" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-medium">
                  {line.productSlug ? <Link href={`/product/${line.productSlug}`} className="hover:underline">{priced?.product_name ?? line.productName}</Link> : (priced?.product_name ?? line.productName)}
                </p>
                {(priced?.variant_label || line.variantLabel) && <p className="text-sm text-muted">{priced?.variant_label || line.variantLabel}</p>}
                <p className="text-sm">{priced ? formatTaka(priced.unit_price) : pending ? '…' : '—'}</p>
                {problem && <p className="error">{problem}</p>}
                <div className="flex items-center gap-3 pt-1">
                  <div className="flex items-center rounded-full border border-line">
                    <button type="button" className="h-9 w-9" aria-label="Decrease quantity" onClick={() => dispatch({ type: 'setQty', variantId: line.variantId, quantity: line.quantity - 1 })}>−</button>
                    <span className="w-7 text-center text-sm font-semibold">{line.quantity}</span>
                    <button type="button" className="h-9 w-9" aria-label="Increase quantity" onClick={() => dispatch({ type: 'setQty', variantId: line.variantId, quantity: line.quantity + 1 })}>+</button>
                  </div>
                  {priced && q?.state === 'insufficient' && priced.stock_left > 0 && (
                    <button type="button" className="text-sm font-semibold text-brand underline" onClick={() => dispatch({ type: 'setQty', variantId: line.variantId, quantity: priced.stock_left })}>
                      Use {priced.stock_left}
                    </button>
                  )}
                  <button type="button" className="ml-auto text-sm text-muted underline hover:text-bad" onClick={() => dispatch({ type: 'remove', variantId: line.variantId })}>
                    Remove
                  </button>
                </div>
              </div>
              <p className="shrink-0 text-right font-semibold">{priced ? formatTaka(priced.unit_price * line.quantity) : ''}</p>
            </li>
          );
        })}
      </ul>

      <aside className="card h-fit space-y-4 p-5 lg:sticky lg:top-24">
        <h2 className="font-display text-2xl font-semibold">Summary</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Subtotal</dt>
            <dd className="font-semibold">{quote ? formatTaka(quote.subtotal) : '…'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Delivery</dt>
            <dd>Chosen at checkout</dd>
          </div>
        </dl>
        {error && <p className="error" role="alert">{error}</p>}
        {hasProblem && <p className="error">Fix the items marked in red before checking out.</p>}
        {hasProblem ? (
          <span className="btn btn-primary w-full" aria-disabled="true">Checkout</span>
        ) : (
          <Link href="/checkout" className="btn btn-primary w-full">Checkout — cash on delivery</Link>
        )}
        <Link href="/products" className="block text-center text-sm text-muted underline">Continue shopping</Link>
      </aside>
    </div>
  );
}
