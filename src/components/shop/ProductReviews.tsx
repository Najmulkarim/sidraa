import type { PublicReview } from '@/lib/catalog';
import type { ProductWithRelations } from '@/lib/types';
import { Icon } from '../icons';
import { ReviewForm } from './ReviewForm';
import { Stars } from './Stars';

const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Dhaka' });

/** Product page: the average with a bar per star, the approved reviews, and the form to write one. */
export function ProductReviews({ product, reviews }: { product: ProductWithRelations; reviews: PublicReview[] }) {
  const count = product.rating_count;
  const avg = Number(product.rating_avg ?? 0);
  const per = [5, 4, 3, 2, 1].map((n) => ({ n, c: reviews.filter((r) => r.rating === n).length }));
  return (
    <section id="reviews" className="mt-14 scroll-mt-24 border-t border-line pt-8">
      <h2 className="section-title">Customer reviews</h2>
      <div className="mt-4"><ReviewForm productId={product.id} /></div>

      {count > 0 ? (
        <div className="mt-6 grid gap-8 md:grid-cols-[16rem_1fr]">
          <div className="space-y-3">
            <p className="flex items-baseline gap-2"><b className="text-[2.4rem] font-bold leading-none">{avg.toFixed(1)}</b><span className="text-muted">out of 5</span></p>
            <Stars avg={avg} count={count} size={18} />
            <ul className="space-y-1.5">
              {per.map(({ n, c }) => (
                <li key={n} className="flex items-center gap-2 text-[12.5px] text-muted">
                  <span className="w-8">{n} ★</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-soft"><span className="block h-full rounded-full bg-[#f59e0b]" style={{ width: `${reviews.length ? (c / reviews.length) * 100 : 0}%` }} /></span>
                  <span className="w-6 text-right">{c}</span>
                </li>
              ))}
            </ul>
          </div>
          <ul className="divide-y divide-line">
            {reviews.map((r) => (
              <li key={r.id} className="py-4 first:pt-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Stars avg={r.rating} count={1} showCount={false} size={14} />
                  <b className="text-[14px]">{r.name}</b>
                  {r.verified && <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-ok"><Icon name="check" size={13} /> Verified purchase</span>}
                  <span className="text-[12px] text-muted">{dateFmt.format(new Date(r.created_at))}</span>
                </div>
                {r.comment && <p className="mt-1.5 whitespace-pre-line text-[14.5px] leading-relaxed text-ink/85">{r.comment}</p>}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-[14px] text-muted">No reviews yet. Bought this? Be the first to tell others how it was.</p>
      )}
    </section>
  );
}
