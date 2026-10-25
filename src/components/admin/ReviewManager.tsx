'use client';

import Link from 'next/link';
import { useActionState, useEffect, useState, useTransition } from 'react';
import { addShopReview, deleteReview, setReviewStatus } from '@/actions/reviews';
import type { ActionState } from '@/lib/types';
import { Icon } from '../icons';
import { ProductImage } from '../shop/ProductImage';
import { Stars } from '../shop/Stars';
import { notify } from './Toaster';

export type AdminReview = {
  id: string; name: string; rating: number; comment: string | null; source: 'customer' | 'shop'; status: 'pending' | 'approved' | 'hidden'; created_at: string;
  product: { id: string; name: string; slug: string; images: { storage_path: string; sort_order: number }[] } | null;
  order: { public_ref: string } | null;
};

const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Dhaka' });

/** The review list for one status, with approve / hide / delete, and the form for reviews customers sent by message. */
export function ReviewManager({ tab, reviews, products }: { tab: string; reviews: AdminReview[]; products: { id: string; name: string; sku: string }[] }) {
  const [list, setList] = useState(reviews);
  const [pending, start] = useTransition();
  useEffect(() => setList(reviews), [reviews]);

  function run(id: string, job: () => Promise<ActionState>) {
    start(async () => {
      const r = await job();
      notify(r.ok, r.message);
      if (r.ok) setList((cur) => cur.filter((x) => x.id !== id));
    });
  }

  return (
    <div className="space-y-5">
      {list.length === 0 ? (
        <p className="card p-6 text-center text-[14px] text-muted">{tab === 'pending' ? 'No reviews waiting. New ones from customers appear here.' : 'Nothing here yet.'}</p>
      ) : (
        <ul className="space-y-3">
          {list.map((r) => {
            const img = r.product ? [...r.product.images].sort((a, b) => a.sort_order - b.sort_order)[0]?.storage_path : null;
            return (
              <li key={r.id} className="card flex flex-col gap-3 p-4 sm:flex-row">
                <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-soft"><ProductImage path={img ?? null} alt="" sizes="64px" /></span>
                <div className="min-w-0 flex-1 space-y-1">
                  {r.product && <Link href={`/product/${r.product.slug}`} target="_blank" className="block truncate text-[13px] font-semibold text-brand-ink hover:underline">{r.product.name}</Link>}
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Stars avg={r.rating} count={1} showCount={false} size={15} />
                    <b className="text-[14px]">{r.name}</b>
                    {r.source === 'customer'
                      ? <span className="badge badge-ok">Verified order {r.order?.public_ref ?? ''}</span>
                      : <span className="badge">Added by shop</span>}
                    <span className="text-[12px] text-muted">{dateFmt.format(new Date(r.created_at))}</span>
                  </p>
                  {r.comment ? <p className="whitespace-pre-line text-[14px] text-ink/85">{r.comment}</p> : <p className="text-[13px] italic text-muted">No comment, stars only.</p>}
                </div>
                <div className="flex shrink-0 flex-wrap items-start gap-1.5">
                  {r.status !== 'approved' && <button type="button" disabled={pending} onClick={() => run(r.id, () => setReviewStatus(r.id, 'approved'))} className="btn btn-sm bg-ok text-white hover:opacity-90"><Icon name="check" size={14} /> Approve</button>}
                  {r.status !== 'hidden' && <button type="button" disabled={pending} onClick={() => run(r.id, () => setReviewStatus(r.id, 'hidden'))} className="btn btn-outline btn-sm"><Icon name="eye" size={14} /> Hide</button>}
                  <button type="button" disabled={pending} onClick={() => { if (window.confirm('Delete this review for good?')) run(r.id, () => deleteReview(r.id)); }} className="btn btn-ghost btn-sm text-bad" aria-label="Delete review"><Icon name="trash" size={14} /></button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <AddReview products={products} />
    </div>
  );
}

/** A review a customer sent on Facebook, WhatsApp or by phone — with their permission. */
function AddReview({ products }: { products: { id: string; name: string; sku: string }[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addShopReview, { ok: false });
  const [rating, setRating] = useState(5);
  const [key, setKey] = useState(0);
  useEffect(() => {
    if (state.message) notify(state.ok, state.message);
    if (state.ok) setKey((k) => k + 1);
  }, [state]);
  return (
    <details className="card p-4">
      <summary className="cursor-pointer text-[14px] font-semibold">+ Add a review a customer sent you</summary>
      <form key={key} action={action} className="mt-4 space-y-3">
        <p className="text-[12.5px] text-muted">Only real reviews from real customers (Facebook, WhatsApp, phone), with their permission. It shows on the product straight away.</p>
        <input type="hidden" name="rating" value={rating} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="field">
            <label className="label" htmlFor="ar-product">Product</label>
            <select id="ar-product" name="productId" required className="input" defaultValue="">
              <option value="" disabled>Choose a product</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
            </select>
          </div>
          <div className="field"><label className="label" htmlFor="ar-name">Customer’s name</label><input id="ar-name" name="name" required maxLength={60} className="input" /></div>
        </div>
        <div className="field">
          <span className="label">Stars</span>
          <div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} stars`} aria-pressed={rating === n} className={`text-[26px] leading-none ${rating >= n ? 'text-[#f59e0b]' : 'text-[#d9d4dc]'}`}>★</button>)}</div>
        </div>
        <div className="field"><label className="label" htmlFor="ar-comment">What they said (optional)</label><textarea id="ar-comment" name="comment" rows={3} maxLength={600} className="input" /></div>
        <button disabled={pending} className="btn btn-primary btn-sm">{pending ? 'Saving…' : 'Add review'}</button>
      </form>
    </details>
  );
}
