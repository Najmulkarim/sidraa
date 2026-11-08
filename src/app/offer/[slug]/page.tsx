import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Icon } from '@/components/icons';
import { Logo } from '@/components/shop/Header';
import { FacebookPixel } from '@/components/shop/FacebookPixel';
import { Gallery } from '@/components/shop/Gallery';
import { LandingOrder } from '@/components/shop/LandingOrder';
import { OfferCountdown } from '@/components/shop/OfferCountdown';
import { Stars } from '@/components/shop/Stars';
import { VariantImageProvider } from '@/components/shop/VariantImage';
import { DescriptionFlow } from '@/components/shop/DescriptionParts';
import { getProductReviews, getSettings, getZones, priceRange, variantPrice, visibleImages } from '@/lib/catalog';
import { freeDelivery } from '@/lib/delivery';
import { imageUrl } from '@/lib/env';
import { formatDate, formatTaka, toNumber } from '@/lib/format';
import { couponSaving, couponWords, videoEmbed } from '@/lib/landing';
import { getLandingPage } from '@/lib/landing-data';
import { paymentOptions, readPaymentSettings } from '@/lib/payments/settings';
import { parseDescription, plainDescription } from '@/lib/product-content';

export const revalidate = 120;

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const lp = await getLandingPage(slug);
  if (!lp) return { title: 'Not found' };
  const title = lp.page.headline || lp.product.name;
  const image = imageUrl(visibleImages(lp.product)[0]?.storage_path);
  return {
    title,
    description: lp.page.subheadline || plainDescription(lp.product.description, 160) || undefined,
    // Ad pages: kept out of Google so they do not compete with the product page.
    robots: { index: false },
    alternates: { canonical: `/offer/${slug}` },
    openGraph: { type: 'website', title, url: `/offer/${slug}`, ...(image ? { images: [{ url: image }] } : {}) },
  };
}

/** A one-product sales page for ads: offer, photos, video, points, FAQ and the order form on the page. */
export default async function LandingPage({ params }: Props) {
  const { slug } = await params;
  const lp = await getLandingPage(slug);
  if (!lp) notFound();
  const { page, product, coupon } = lp;
  const [settings, zones, pay, reviews] = await Promise.all([getSettings(), getZones(), readPaymentSettings(), page.show_reviews ? getProductReviews(product.id) : Promise.resolve([])]);

  const variants = product.variants
    .filter((v) => v.is_active)
    .map((v) => ({ id: v.id, color: v.color, size: v.size, option3: v.option3 ?? '', image_path: v.image_path ?? null, price: variantPrice(product, v), stock: product.stock_out_mode === 'continue' ? Math.max(v.stock, 99) : v.stock, sku: v.sku }));
  const images = visibleImages(product);
  const { min, max } = priceRange(product);
  const compare = product.compare_at_price === null ? null : toNumber(product.compare_at_price);
  const regular = compare !== null && compare > min ? compare : null;
  const saving = couponSaving(min, coupon);
  const offerPrice = min - saving;
  const was = regular ?? (saving > 0 ? min : null);
  const pct = was ? Math.round((1 - offerPrice / was) * 100) : 0;
  const activeZones = zones.filter((z) => z.is_active !== false);
  const free = freeDelivery(activeZones);
  const video = page.video_url ? videoEmbed(page.video_url) : null;
  const content = page.show_description ? parseDescription(product.description) : null;
  const cta = page.button_text || 'Order now';
  const ctaClass = 'btn btn-primary min-h-13 w-full text-base shadow-lg sm:w-auto sm:px-10';

  return (
    <div className="min-h-dvh bg-soft/40 pb-24 md:pb-10">
      {settings.fb_pixel_id && <FacebookPixel pixelId={settings.fb_pixel_id} />}

      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2.5">
          <Link href="/" aria-label={`${settings.store_name} home`}><Logo settings={settings} className="h-9" /></Link>
          {settings.phone && (
            <a href={`tel:${settings.phone}`} className="flex items-center gap-1.5 rounded-full bg-tint px-3 py-1.5 text-[13px] font-semibold text-brand">
              <Icon name="phone" size={15} /> {settings.phone}
            </a>
          )}
        </div>
      </header>

      <VariantImageProvider>
        <main className="mx-auto max-w-5xl space-y-6 px-4 py-5 md:space-y-10 md:py-8">
          {/* Hero: photos, the offer, the button */}
          <section className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start md:gap-8">
            <Gallery images={images} name={product.name} badge={pct > 0 ? `${pct}% OFF` : null} />
            <div className="space-y-4">
              {page.offer_text && (
                <p className="inline-flex items-center gap-1.5 rounded-full bg-[linear-gradient(105deg,var(--brand),var(--plum))] px-3.5 py-1.5 text-[13px] font-bold text-white shadow-sm">
                  <Icon name="star" size={14} /> {page.offer_text}
                </p>
              )}
              <h1 className="font-display text-[1.9rem] font-semibold leading-[1.12] sm:text-[2.4rem]">{page.headline || product.name}</h1>
              {page.subheadline && <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink/80">{page.subheadline}</p>}
              {product.rating_count > 0 && <Stars avg={product.rating_avg} count={product.rating_count} size={15} />}

              <div className="rounded-2xl border border-brand/20 bg-white p-4 shadow-sm">
                <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  {saving > 0 && <span className="text-[12px] font-bold uppercase tracking-wide text-brand">Offer price</span>}
                  <span className="text-[2.1rem] font-bold leading-none text-ink">{min !== max ? 'from ' : ''}{formatTaka(offerPrice)}</span>
                  {was && <s className="text-lg text-muted">{formatTaka(was)}</s>}
                  {pct > 0 && <span className="rounded-md bg-bad px-2 py-0.5 text-[13px] font-bold text-white">-{pct}%</span>}
                </p>
                {was && <p className="mt-1.5 text-[13px] font-semibold text-ok">You save {formatTaka(was - offerPrice)}</p>}
                {coupon && saving > 0 && <p className="mt-1 text-[12.5px] text-muted">{couponWords(coupon)} with code <b className="font-mono text-ink">{coupon.code}</b>, added for you at checkout{coupon.min_subtotal > 0 ? ` (orders over ${formatTaka(coupon.min_subtotal)})` : ''}.</p>}
                {coupon?.ends_at && <div className="mt-3 border-t border-line pt-3"><OfferCountdown endsAt={coupon.ends_at} /></div>}
              </div>

              <a href="#order" className={ctaClass}>{cta} <Icon name="arrow" size={18} className="rotate-90" /></a>

              <ul className="grid gap-2 text-[13px] sm:grid-cols-2">
                <li className="flex items-center gap-2"><Icon name="truck" size={17} className="text-brand" /> Cash on delivery all over Bangladesh</li>
                {free && <li className="flex items-center gap-2"><Icon name="check" size={17} className="text-ok" /> FREE delivery {free.text}</li>}
                <li className="flex items-center gap-2"><Icon name="shield" size={17} className="text-brand" /> Return within {settings.return_policy_days} day{settings.return_policy_days === 1 ? '' : 's'}</li>
                <li className="flex items-center gap-2"><Icon name="phone" size={17} className="text-brand" /> We call to confirm before sending</li>
              </ul>
            </div>
          </section>

          {video && (
            <section className="mx-auto max-w-3xl">
              <div className="relative aspect-video overflow-hidden rounded-2xl bg-night shadow-lg">
                <iframe src={video} title={`${product.name} video`} className="absolute inset-0 h-full w-full" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
              </div>
            </section>
          )}

          {page.benefits.length > 0 && (
            <section className="card p-5 sm:p-7">
              <h2 className="mb-4 text-center font-display text-2xl font-semibold sm:text-3xl">Why you will love it</h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {page.benefits.map((b, i) => (
                  <li key={i} className="flex gap-3 rounded-xl bg-tint/60 p-3 text-[14.5px]">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand text-white"><Icon name="check" size={14} strokeWidth={3} /></span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {content && content.flow.length > 0 && (
            <section className="card p-5 sm:p-7">
              <h2 className="mb-4 font-display text-2xl font-semibold">About this item</h2>
              <DescriptionFlow flow={content.flow} />
              {content.specs.length > 0 && (
                <table className="mt-5 w-full overflow-hidden rounded-xl border border-line text-[14px]">
                  <tbody>
                    {content.specs.map(([k, v]) => (
                      <tr key={k} className="border-b border-line last:border-0">
                        <th scope="row" className="w-2/5 bg-soft px-3 py-2.5 text-left font-semibold">{k}</th>
                        <td className="px-3 py-2.5">{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          )}

          {reviews.length > 0 && (
            <section className="card p-5 sm:p-7">
              <h2 className="mb-1 font-display text-2xl font-semibold">What customers say</h2>
              <Stars avg={product.rating_avg} count={product.rating_count} size={15} />
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {reviews.slice(0, 6).map((r) => (
                  <li key={r.id} className="rounded-xl border border-line p-4">
                    <p className="flex items-center justify-between gap-2"><span className="font-semibold">{r.name}</span><Stars avg={r.rating} count={0} showCount={false} size={13} /></p>
                    {r.comment && <p className="mt-1.5 text-[14px] text-ink/85">{r.comment}</p>}
                    <p className="mt-1.5 text-[11.5px] text-muted">{r.verified ? 'Verified buyer · ' : ''}{formatDate(r.created_at)}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {page.faqs.length > 0 && (
            <section className="card p-5 sm:p-7">
              <h2 className="mb-4 font-display text-2xl font-semibold">Questions</h2>
              <div className="divide-y divide-line">
                {page.faqs.map((f, i) => (
                  <details key={i} className="group py-3" open={i === 0}>
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold">
                      {f.q}
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-tint text-brand transition group-open:rotate-45">+</span>
                    </summary>
                    <p className="mt-2 whitespace-pre-line text-[14px] text-ink/80">{f.a}</p>
                  </details>
                ))}
              </div>
            </section>
          )}

          <section id="order" className="mx-auto max-w-2xl scroll-mt-4 space-y-4">
            <h2 className="text-center font-display text-3xl font-semibold">Order now</h2>
            <p className="text-center text-[14px] text-muted">Fill in your details. You pay when the parcel reaches you.</p>
            {variants.length === 0 || activeZones.length === 0 ? (
              <p className="card p-6 text-center text-muted">This product cannot be ordered right now. Please call us.</p>
            ) : (
              <LandingOrder
                slug={page.slug}
                productId={product.id}
                productName={product.name}
                productSlug={product.slug}
                imagePath={images[0]?.storage_path ?? null}
                variants={variants}
                labels={{ color_label: product.color_label, size_label: product.size_label, option3_label: product.option3_label }}
                imageOrder={images.map((i) => i.storage_path)}
                keepOrder={product.variants.some((v) => v.sort_order > 0)}
                preorder={product.stock_out_mode === 'preorder'}
                coupon={coupon?.code ?? null}
                buttonText={page.button_text}
                zones={activeZones}
                codTerms={settings.cod_terms}
                returnDays={settings.return_policy_days}
                payments={paymentOptions(pay)}
              />
            )}
          </section>
        </main>
      </VariantImageProvider>

      <footer className="mx-auto max-w-5xl px-4 pb-6 text-center text-[12.5px] text-muted">
        <Link href="/" className="font-semibold text-ink hover:text-brand">{settings.store_name}</Link>
        {settings.phone && <> · <a href={`tel:${settings.phone}`} className="hover:text-brand">{settings.phone}</a></>}
        {' · '}<Link href="/info/returns" className="hover:text-brand">Return policy</Link>
      </footer>

      {/* Phones: the order button stays at the bottom of the screen. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 p-3 backdrop-blur md:hidden">
        <a href="#order" className="btn btn-primary min-h-12 w-full text-base">{cta} · {formatTaka(offerPrice)}</a>
      </div>
    </div>
  );
}
