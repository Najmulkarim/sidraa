import type { ReactNode } from 'react';
import { Icon } from '@/components/icons';
import { ProductImage } from '@/components/shop/ProductImage';
import { Stars } from '@/components/shop/Stars';
import { formatDate, formatTaka } from '@/lib/format';
import type { Faq } from '@/lib/landing';
import type { Showcase, ShowcaseItem } from '@/lib/showcase';
import type { PublicReview } from '@/lib/catalog';
import { whatsappOrderLink } from '@/lib/product-content';

export type ShowcaseOffer = { price: number; from: boolean; was: number | null; pct: number; countdown: ReactNode };

/** The "Showcase" landing page template. Empty parts are left out. */
export function ShowcaseView({
  s, name, photo, offer, cta, offerText, video, reviews, rating, faqs, phone, order,
}: {
  s: Showcase;
  name: string;
  /** First product photo: used where a section has none. */
  photo: string | null;
  offer: ShowcaseOffer;
  cta: string;
  offerText: string | null;
  video: string | null;
  reviews: PublicReview[];
  rating: { avg: number | string | null; count: number };
  faqs: Faq[];
  phone: string | null;
  order: ReactNode;
}) {
  const heroImg = s.hero.image ?? photo;
  const filled = (xs: ShowcaseItem[]) => xs.filter((i) => i.title);
  const features = filled(s.features.items);
  const left = filled(s.around.left);
  const right = filled(s.around.right);
  const cards = s.cards.items.filter((c) => c.image || c.title);
  const wa = whatsappOrderLink(phone, `Hi, I have a question about ${name}`);

  return (
    <div className="space-y-14 sm:space-y-20">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-[1.75rem] bg-[radial-gradient(120%_120%_at_80%_20%,#3a2c4a_0%,#17141f_55%,#0d0b12_100%)] text-white shadow-2xl">
        <div className="grid items-center gap-6 p-6 sm:p-10 md:grid-cols-[1.05fr_1fr] md:p-12">
          <div className="relative z-10 space-y-4">
            {(offerText || s.hero.eyebrow) && (
              <p className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-white/90 ring-1 ring-white/15">
                <Icon name="sparkle" size={13} /> {offerText || s.hero.eyebrow}
              </p>
            )}
            <h1 className="font-display text-[2.2rem] font-bold uppercase leading-[1.02] tracking-tight sm:text-[3.2rem]">{s.hero.title || name}</h1>
            {s.hero.text && <p className="max-w-md text-[15px] leading-relaxed text-white/75">{s.hero.text}</p>}
            <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-3xl font-bold">{offer.from ? 'from ' : ''}{formatTaka(offer.price)}</span>
              {offer.was && <s className="text-lg text-white/50">{formatTaka(offer.was)}</s>}
              {offer.pct > 0 && <span className="rounded-md bg-brand px-2 py-0.5 text-[13px] font-bold">-{offer.pct}%</span>}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <a href="#order" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-brand px-7 text-[15px] font-bold text-white shadow-lg shadow-brand/30 transition hover:brightness-110">
                {s.hero.button || cta} <Icon name="arrow" size={17} />
              </a>
              <span className="flex items-center gap-1.5 text-[13px] text-white/70"><Icon name="cash" size={16} /> Cash on delivery</span>
            </div>
          </div>
          {heroImg && (
            <div className="relative mx-auto aspect-square w-full max-w-md">
              <div className="absolute inset-[12%] rounded-full bg-brand/30 blur-3xl" aria-hidden="true" />
              <div className="relative h-full overflow-hidden rounded-[1.5rem] ring-1 ring-white/10">
                <ProductImage path={heroImg} alt={name} sizes="(min-width: 768px) 448px, 90vw" priority />
              </div>
              {rating.count > 0 && (
                <span className="absolute -bottom-3 left-4 flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-ink shadow-xl">
                  <Stars avg={rating.avg} count={rating.count} size={13} />
                </span>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Main features beside a photo */}
      {s.features.on && features.length > 0 && (
        <section className="grid items-center gap-8 md:grid-cols-2 md:gap-12">
          <div>
            <Eyebrow>{s.features.eyebrow}</Eyebrow>
            {s.features.title && <h2 className="mb-6 font-display text-3xl font-bold sm:text-4xl">{s.features.title}</h2>}
            <ul className="space-y-5">
              {features.map((f, i) => (
                <li key={i} className="flex gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-tint text-brand"><Icon name={f.icon} size={21} /></span>
                  <span>
                    <span className="block font-semibold text-ink">{f.title}</span>
                    {f.text && <span className="block text-[14px] text-muted">{f.text}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          {(s.features.image ?? photo) && (
            <div className="relative aspect-[4/5] overflow-hidden rounded-[1.5rem] bg-tint shadow-xl md:order-none">
              <ProductImage path={s.features.image ?? photo} alt={name} sizes="(min-width: 768px) 480px, 92vw" />
            </div>
          )}
        </section>
      )}

      {/* Wide banner */}
      {s.banner1.on && s.banner1.image && (
        <Banner title={s.banner1.title} text={s.banner1.text} image={s.banner1.image} alt={name} />
      )}

      {video && (
        <section className="mx-auto max-w-3xl">
          <div className="relative aspect-video overflow-hidden rounded-[1.5rem] bg-night shadow-xl">
            <iframe src={video} title={`${name} video`} className="absolute inset-0 h-full w-full" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
          </div>
        </section>
      )}

      {/* Features on both sides of a photo */}
      {s.around.on && (left.length > 0 || right.length > 0) && (
        <section>
          <Heading eyebrow={s.around.eyebrow} title={s.around.title} text={s.around.text} />
          <div className="mt-8 grid items-center gap-8 md:grid-cols-[1fr_minmax(0,22rem)_1fr]">
            <SideList items={left} align="right" />
            {(s.around.image ?? photo) && (
              <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-full bg-tint shadow-xl ring-8 ring-tint/60">
                <ProductImage path={s.around.image ?? photo} alt={name} sizes="352px" />
              </div>
            )}
            <SideList items={right} align="left" />
          </div>
        </section>
      )}

      {/* Second banner */}
      {s.banner2.on && s.banner2.image && (
        <section>
          <Heading eyebrow={s.banner2.eyebrow} title={s.banner2.title} text={s.banner2.text} />
          <div className="relative mt-6 aspect-[16/8] overflow-hidden rounded-[1.5rem] bg-night shadow-xl">
            <ProductImage path={s.banner2.image} alt={name} sizes="(min-width: 1024px) 1024px, 92vw" />
          </div>
        </section>
      )}

      {/* Photo cards */}
      {s.cards.on && cards.length > 0 && (
        <section>
          <Heading eyebrow={s.cards.eyebrow} title={s.cards.title} text={s.cards.text} />
          <ul className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3">
            {cards.map((c, i) => (
              <li key={i} className="group">
                <div className="relative aspect-square overflow-hidden rounded-2xl bg-tint">
                  {c.image && <ProductImage path={c.image} alt={c.title || name} sizes="(min-width: 768px) 330px, 46vw" className="object-cover transition duration-500 group-hover:scale-105" />}
                </div>
                {c.title && <h3 className="mt-3 font-semibold text-ink">{c.title}</h3>}
                {c.text && <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{c.text}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Buy box */}
      <section id="order" className="scroll-mt-4">
        <Heading eyebrow={s.buy.eyebrow} title={s.buy.title || name} text={s.buy.text} />
        <div className="mx-auto mt-6 max-w-2xl space-y-4">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-2xl bg-tint/70 px-4 py-3 text-center">
            <span className="text-2xl font-bold">{offer.from ? 'from ' : ''}{formatTaka(offer.price)}</span>
            {offer.was && <s className="text-muted">{formatTaka(offer.was)}</s>}
            {offer.pct > 0 && <span className="rounded-md bg-bad px-2 py-0.5 text-[13px] font-bold text-white">-{offer.pct}%</span>}
            {offer.countdown}
          </div>
          {order}
        </div>
      </section>

      {/* Real, approved reviews only */}
      {reviews.length > 0 && (
        <section>
          <Heading eyebrow={s.reviews.eyebrow} title={s.reviews.title || 'Feedback from our customers'} />
          <ul className="mt-8 grid gap-4 md:grid-cols-3">
            {reviews.slice(0, 6).map((r) => (
              <li key={r.id} className="rounded-2xl border border-line bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-tint font-bold text-brand">{r.name.slice(0, 1).toUpperCase()}</span>
                  <span>
                    <span className="block font-semibold">{r.name}</span>
                    <Stars avg={r.rating} count={0} showCount={false} size={12} />
                  </span>
                </div>
                {r.comment && <p className="mt-3 text-[14px] leading-relaxed text-ink/80">“{r.comment}”</p>}
                <p className="mt-2 text-[11.5px] text-muted">{r.verified ? 'Verified buyer · ' : ''}{formatDate(r.created_at)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {faqs.length > 0 && (
        <section className="mx-auto max-w-3xl">
          <Heading title="Questions" />
          <div className="mt-6 divide-y divide-line rounded-2xl border border-line bg-white px-5">
            {faqs.map((f, i) => (
              <details key={i} className="group py-4" open={i === 0}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold">
                  {f.q}
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-tint text-brand transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 whitespace-pre-line text-[14px] text-ink/80">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* Contact */}
      {s.contact.on && phone && (
        <section className="rounded-[1.75rem] bg-night px-6 py-10 text-center text-white sm:px-10">
          {s.contact.eyebrow && <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-white/60">{s.contact.eyebrow}</p>}
          <h2 className="font-display text-3xl font-bold">{s.contact.title || 'Get in touch'}</h2>
          {s.contact.text && <p className="mx-auto mt-2 max-w-md text-[14.5px] text-white/70">{s.contact.text}</p>}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <a href={`tel:${phone}`} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-6 font-bold text-ink"><Icon name="phone" size={17} /> {phone}</a>
            {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#25d366] px-6 font-bold text-white"><Icon name="whatsapp" size={17} /> WhatsApp</a>}
          </div>
        </section>
      )}
    </div>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return children ? <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-brand">{children}</p> : null;
}

function Heading({ eyebrow, title, text }: { eyebrow?: string; title?: string; text?: string }) {
  if (!eyebrow && !title && !text) return null;
  return (
    <div className="mx-auto max-w-2xl text-center">
      <Eyebrow>{eyebrow}</Eyebrow>
      {title && <h2 className="font-display text-3xl font-bold sm:text-4xl">{title}</h2>}
      {text && <p className="mt-3 text-[14.5px] leading-relaxed text-muted">{text}</p>}
    </div>
  );
}

function Banner({ title, text, image, alt }: { title: string; text: string; image: string; alt: string }) {
  return (
    <section>
      <Heading title={title} text={text} />
      <div className="relative mt-6 aspect-[16/8] overflow-hidden rounded-[1.5rem] bg-night shadow-xl">
        <ProductImage path={image} alt={alt} sizes="(min-width: 1024px) 1024px, 92vw" />
      </div>
    </section>
  );
}

function SideList({ items, align }: { items: ShowcaseItem[]; align: 'left' | 'right' }) {
  if (!items.length) return <div className="hidden md:block" />;
  return (
    <ul className="space-y-6">
      {items.map((f, i) => (
        <li key={i} className={`flex items-start gap-3 ${align === 'right' ? 'md:flex-row-reverse md:text-right' : ''}`}>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-tint text-brand"><Icon name={f.icon} size={20} /></span>
          <span>
            <span className="block font-semibold text-ink">{f.title}</span>
            {f.text && <span className="block text-[13.5px] text-muted">{f.text}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
