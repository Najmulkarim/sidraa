'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { deleteLanding, saveLanding } from '@/actions/admin-landing';
import { videoEmbed, type Faq, type LandingPage } from '@/lib/landing';
import { slugify } from '@/lib/slug';
import { Icon } from '../icons';
import { ProductImage } from '../shop/ProductImage';
import { ConfirmDialog } from './ConfirmDialog';
import { notify } from './Toaster';

export type LandingProduct = { id: string; name: string; sku: string; image: string | null; status: string };
export type LandingCoupon = { code: string; words: string; live: boolean };

/**
 * Make or edit a landing page: the product, the link (/offer/…), the offer
 * (badge + coupon), headline, video, points and questions.
 */
export function LandingForm({ page, products, coupons }: { page?: LandingPage; products: LandingProduct[]; coupons: LandingCoupon[] }) {
  const router = useRouter();
  const [productId, setProductId] = useState(page?.product_id ?? '');
  const [slug, setSlug] = useState(page?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(!!page);
  const [isActive, setActive] = useState(page?.is_active ?? true);
  const [headline, setHeadline] = useState(page?.headline ?? '');
  const [subheadline, setSub] = useState(page?.subheadline ?? '');
  const [offerText, setOfferText] = useState(page?.offer_text ?? '');
  const [couponCode, setCoupon] = useState(page?.coupon_code ?? '');
  const [videoUrl, setVideo] = useState(page?.video_url ?? '');
  const [benefits, setBenefits] = useState<string[]>(page?.benefits.length ? page.benefits : ['', '', '']);
  const [faqs, setFaqs] = useState<Faq[]>(page?.faqs.length ? page.faqs : [{ q: '', a: '' }]);
  const [buttonText, setButton] = useState(page?.button_text ?? '');
  const [showDescription, setShowDescription] = useState(page?.show_description ?? true);
  const [showReviews, setShowReviews] = useState(page?.show_reviews ?? true);
  const [q, setQ] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, startSave] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [asking, setAsking] = useState(false);

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const product = byId.get(productId);
  const found = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return products.filter((p) => `${p.name} ${p.sku}`.toLowerCase().includes(t)).slice(0, 8);
  }, [q, products]);

  const choose = (p: LandingProduct) => {
    setProductId(p.id);
    setQ('');
    if (!slugTouched) setSlug(slugify(p.name).slice(0, 60).replace(/-+$/, ''));
  };

  const save = () => startSave(async () => {
    setErrors({});
    const r = await saveLanding({
      id: page?.id, slug, productId, isActive, headline, subheadline, offerText, couponCode, videoUrl,
      benefits, faqs, buttonText, showDescription, showReviews,
    });
    if (r) {
      notify(r.ok, r.message);
      if (r.fieldErrors) setErrors(r.fieldErrors);
      if (r.ok) router.refresh();
    }
  });
  const remove = () => startDelete(async () => {
    const r = await deleteLanding(page!.id);
    notify(r.ok, r.message);
    if (r.ok) router.push('/admin/landing-pages');
  });

  const input = 'input h-10 text-[14px]';
  const err = (k: string) => errors[k] && <p className="error">{errors[k]}</p>;
  const videoOk = !videoUrl.trim() || videoEmbed(videoUrl) !== null;

  return (
    <div className="max-w-3xl space-y-6">
      <section className="card space-y-4 p-5">
        <h2 className="font-semibold">1. Product</h2>
        {product ? (
          <div className="flex items-center gap-3 rounded-xl bg-soft p-2.5">
            <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-tint"><ProductImage path={product.image} alt="" sizes="56px" /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{product.name}</span>
              <span className="font-mono text-[12px] text-muted">{product.sku}</span>
              {product.status !== 'published' && <span className="ml-2 text-[12px] font-semibold text-warn">{product.status} — publish it, or the page will not open</span>}
            </span>
            <button type="button" onClick={() => setProductId('')} className="btn btn-outline btn-sm">Change</button>
          </div>
        ) : (
          <div className="relative">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the product by name or SKU" className={input} autoFocus={!page} />
            {found.length > 0 && (
              <ul className="absolute inset-x-0 top-full z-10 mt-1 max-h-72 overflow-y-auto rounded-xl border border-line bg-white shadow-xl">
                {found.map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => choose(p)} className="flex w-full items-center gap-3 px-3 py-2 text-left text-[13px] hover:bg-soft">
                      <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md bg-tint"><ProductImage path={p.image} alt="" sizes="36px" /></span>
                      <span className="min-w-0 flex-1"><span className="block truncate">{p.name}</span><span className="font-mono text-[11.5px] text-muted">{p.sku}{p.status !== 'published' ? ` · ${p.status}` : ''}</span></span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {err('productId')}
          </div>
        )}
        <label className="field"><span className="label">Link</span>
          <span className="flex items-center overflow-hidden rounded-xl border border-line focus-within:border-brand">
            <span className="bg-soft px-3 py-2 font-mono text-[13px] text-muted">sidraabd.com/offer/</span>
            <input value={slug} onChange={(e) => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')); setSlugTouched(true); }} maxLength={60} placeholder="eid-abaya" className="min-w-0 flex-1 px-2 py-2 font-mono text-[14px] outline-none" />
          </span>
          {err('slug')}
        </label>
        <label className="flex items-center gap-2 text-[14px]">
          <input type="checkbox" checked={isActive} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-[var(--brand)]" />
          Page is live (untick to switch it off)
        </label>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="font-semibold">2. Offer</h2>
        <p className="text-[13px] text-muted">The price comes from the product. To show a cut price, set the product’s <b>Compare-at price</b>. For an extra discount, choose a coupon: the page adds it for the customer by itself, and shows a countdown if the coupon has an end date.</p>
        <label className="field"><span className="label">Offer badge (optional)</span>
          <input value={offerText} onChange={(e) => setOfferText(e.target.value)} maxLength={120} placeholder="e.g. Eid offer · Free delivery in Dhaka" className={input} />
        </label>
        <label className="field"><span className="label">Coupon added automatically (optional)</span>
          <select value={couponCode} onChange={(e) => setCoupon(e.target.value)} className={input}>
            <option value="">No coupon</option>
            {coupons.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.words}{c.live ? '' : ' (not active now)'}</option>)}
          </select>
          {err('couponCode')}
          <span className="hint"><Link href="/admin/coupons" className="underline" target="_blank">Make a coupon</Link> (set an end date for a countdown).</span>
        </label>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="font-semibold">3. Words &amp; video</h2>
        <label className="field"><span className="label">Headline</span>
          <input value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={160} placeholder={product?.name ?? 'The product name is used if empty'} className={input} />
        </label>
        <label className="field"><span className="label">Short text under the headline</span>
          <textarea value={subheadline} onChange={(e) => setSub(e.target.value)} maxLength={400} rows={3} placeholder="Why this product, in two lines" className="input text-[14px]" />
        </label>
        <label className="field"><span className="label">Video link (YouTube or Facebook, optional)</span>
          <input value={videoUrl} onChange={(e) => setVideo(e.target.value)} maxLength={300} placeholder="https://youtu.be/…" className={input} />
          {!videoOk && <p className="error">This is not a YouTube or Facebook video link.</p>}
          {err('videoUrl')}
        </label>
        <label className="field"><span className="label">Button text</span>
          <input value={buttonText} onChange={(e) => setButton(e.target.value)} maxLength={40} placeholder="Order now" className={input} />
        </label>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">4. Why buy it (points with a ✓)</h2>
        {benefits.map((b, i) => (
          <div key={i} className="flex gap-2">
            <input value={b} onChange={(e) => setBenefits((cur) => cur.map((x, n) => (n === i ? e.target.value : x)))} maxLength={200} placeholder={['e.g. Soft breathable fabric', 'e.g. Fits sizes M to XXL', 'e.g. Colour does not fade'][i] ?? ''} className={input} />
            <button type="button" aria-label="Remove point" onClick={() => setBenefits((cur) => cur.filter((_, n) => n !== i))} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-line text-muted hover:text-bad"><Icon name="x" size={15} /></button>
          </div>
        ))}
        {benefits.length < 12 && <button type="button" onClick={() => setBenefits((cur) => [...cur, ''])} className="btn btn-outline btn-sm"><Icon name="plus" size={14} /> Add a point</button>}
        {err('benefits')}
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">5. Questions &amp; answers</h2>
        {faqs.map((f, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-line p-3">
            <div className="flex gap-2">
              <input value={f.q} onChange={(e) => setFaqs((cur) => cur.map((x, n) => (n === i ? { ...x, q: e.target.value } : x)))} maxLength={200} placeholder="Question, e.g. How long does delivery take?" className={input} />
              <button type="button" aria-label="Remove question" onClick={() => setFaqs((cur) => cur.filter((_, n) => n !== i))} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-line text-muted hover:text-bad"><Icon name="x" size={15} /></button>
            </div>
            <textarea value={f.a} onChange={(e) => setFaqs((cur) => cur.map((x, n) => (n === i ? { ...x, a: e.target.value } : x)))} maxLength={1000} rows={2} placeholder="Answer" className="input text-[14px]" />
          </div>
        ))}
        {faqs.length < 12 && <button type="button" onClick={() => setFaqs((cur) => [...cur, { q: '', a: '' }])} className="btn btn-outline btn-sm"><Icon name="plus" size={14} /> Add a question</button>}
        {err('faqs')}
      </section>

      <section className="card space-y-2 p-5">
        <h2 className="font-semibold">6. Also show</h2>
        <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" checked={showDescription} onChange={(e) => setShowDescription(e.target.checked)} className="h-4 w-4 accent-[var(--brand)]" /> The product description and details</label>
        <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" checked={showReviews} onChange={(e) => setShowReviews(e.target.checked)} className="h-4 w-4 accent-[var(--brand)]" /> Customer reviews of this product (only real, approved ones)</label>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={saving || !productId || !slug || !videoOk} className="btn btn-primary">{saving ? 'Saving…' : page ? 'Save landing page' : 'Create landing page'}</button>
        <Link href="/admin/landing-pages" className="btn btn-outline">Back</Link>
        {page && (
          <>
            <a href={`/offer/${page.slug}`} target="_blank" rel="noreferrer" className="text-sm font-semibold text-muted hover:text-brand">View page ↗</a>
            <button type="button" onClick={() => setAsking(true)} className="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold text-bad hover:underline"><Icon name="trash" size={15} /> Delete</button>
          </>
        )}
      </div>

      {page && (
        <ConfirmDialog open={asking} title="Delete this landing page?" confirmLabel="Yes, delete" pendingLabel="Deleting…" pending={deleting} onClose={() => setAsking(false)} onConfirm={remove}>
          The link stops working (ads pointing to it will show “not found”). The product and orders are not touched.
        </ConfirmDialog>
      )}
    </div>
  );
}
