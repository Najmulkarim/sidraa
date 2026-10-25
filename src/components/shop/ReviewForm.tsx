'use client';

import { useActionState, useState } from 'react';
import { submitReview, type ReviewState } from '@/actions/reviews';

/** "Write a review": order number + phone prove the purchase; the shop approves before it shows. */
export function ReviewForm({ productId }: { productId: string }) {
  const [state, action, pending] = useActionState<ReviewState, FormData>(submitReview, { ok: false });
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  // Kept in state so an error does not empty the form.
  const [v, setV] = useState({ ref: '', phone: '', name: '', comment: '' });
  const field = (k: keyof typeof v) => ({ name: k, value: v[k], onChange: (e: { target: { value: string } }) => setV((cur) => ({ ...cur, [k]: e.target.value })) });

  if (state.ok) return <p role="status" className="rounded-xl bg-ok/10 px-4 py-3 text-[14px] text-ok">{state.message}</p>;
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="btn btn-outline btn-sm">Write a review</button>;

  const err = state.errors ?? {};
  return (
    <form action={action} className="card space-y-4 p-4 sm:p-5">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="rating" value={rating || ''} />
      <p className="text-[13px] text-muted">Bought this? Tell other shoppers how it was. Use the order number and phone from your order — reviews show after a quick check.</p>
      <fieldset>
        <legend className="label">Your rating</legend>
        <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => setRating(n)} onMouseEnter={() => setHover(n)} aria-label={`${n} star${n === 1 ? '' : 's'}`} aria-pressed={rating === n}
              className={`text-[28px] leading-none transition ${(hover || rating) >= n ? 'text-[#f59e0b]' : 'text-[#d9d4dc]'}`}>★</button>
          ))}
        </div>
        {err.rating && <p className="mt-1 text-[12.5px] text-bad">{err.rating}</p>}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="field"><label className="label" htmlFor="rv-ref">Order number</label><input id="rv-ref" {...field('ref')} required maxLength={30} placeholder="Order0001" className="input" />{err.ref && <span className="text-[12.5px] text-bad">{err.ref}</span>}</div>
        <div className="field"><label className="label" htmlFor="rv-phone">Phone</label><input id="rv-phone" {...field('phone')} type="tel" inputMode="tel" required maxLength={20} placeholder="01XXXXXXXXX" className="input" />{err.phone && <span className="text-[12.5px] text-bad">{err.phone}</span>}</div>
        <div className="field"><label className="label" htmlFor="rv-name">Your name</label><input id="rv-name" {...field('name')} required maxLength={60} className="input" />{err.name && <span className="text-[12.5px] text-bad">{err.name}</span>}</div>
      </div>
      <div className="field"><label className="label" htmlFor="rv-comment">Your review (optional)</label><textarea id="rv-comment" {...field('comment')} rows={3} maxLength={600} className="input" placeholder="Fabric, fit, delivery…" /></div>
      {state.message && <p role="alert" className="rounded-lg bg-bad/10 px-3 py-2 text-[13px] text-bad">{state.message}</p>}
      <div className="flex gap-2">
        <button disabled={pending} className="btn btn-primary btn-sm">{pending ? 'Sending…' : 'Send review'}</button>
        <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost btn-sm">Cancel</button>
      </div>
    </form>
  );
}
