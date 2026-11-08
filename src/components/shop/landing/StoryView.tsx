import type { ReactNode } from 'react';
import { Icon } from '@/components/icons';
import { Gallery } from '@/components/shop/Gallery';
import { imageUrl } from '@/lib/env';
import { formatTaka } from '@/lib/format';
import type { Faq } from '@/lib/landing';
import { whatsappOrderLink } from '@/lib/product-content';
import { STORY_DEFAULTS, type Story } from '@/lib/story';
import type { ShowcaseOffer } from './ShowcaseView';

type Photo = { id: string; storage_path: string; alt: string | null };

/** The "Story" landing page template. Empty parts are left out. */
export function StoryView({
  s, name, images, offer, offerText, video, faqs, phone, order,
}: {
  s: Story;
  name: string;
  images: Photo[];
  offer: ShowcaseOffer;
  offerText: string | null;
  video: string | null;
  faqs: Faq[];
  phone: string | null;
  order: ReactNode;
}) {
  const wa = whatsappOrderLink(phone, `আমি অর্ডার করতে চাই: ${name}`);
  const blocks = s.blocks.filter((b) => b.title || b.text || b.points.some((p) => p.text));

  return (
    <div className="space-y-10 sm:space-y-14">
      {/* Top: like a product page */}
      <section className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start md:gap-10">
        <Gallery images={images} name={name} badge={offer.pct > 0 ? `${offer.pct}% OFF` : null} />
        <div className="space-y-4">
          {offerText && <p className="inline-flex rounded-full bg-tint px-3 py-1 text-[13px] font-bold text-brand">{offerText}</p>}
          <h1 className="text-[1.75rem] font-bold leading-tight sm:text-[2.1rem]">{name}</h1>
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {offer.was && <s className="text-xl text-muted">{formatTaka(offer.was)}</s>}
            <span className="text-[2rem] font-bold leading-none text-bad">{offer.from ? 'from ' : ''}{formatTaka(offer.price)}</span>
            {offer.pct > 0 && <span className="rounded-md bg-bad px-2 py-0.5 text-[13px] font-bold text-white">-{offer.pct}%</span>}
          </p>
          {offer.countdown}
          <div className="grid gap-2.5 pt-1">
            <a href="#order" className="flex min-h-13 items-center justify-center gap-2 rounded-xl bg-bad px-5 text-[17px] font-bold text-white shadow-md transition hover:brightness-110">
              <Icon name="bag" size={20} /> {s.top.order || STORY_DEFAULTS.order}
            </a>
            <div className="grid grid-cols-2 gap-2.5">
              {wa && (
                <a href={wa} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-[#25d366] px-3 text-[14px] font-bold text-white">
                  <Icon name="whatsapp" size={18} /> {s.top.whatsapp || STORY_DEFAULTS.whatsapp}
                </a>
              )}
              {phone && (
                <a href={`tel:${phone}`} className={`flex min-h-12 items-center justify-center gap-1.5 rounded-xl border-2 border-ink px-3 text-[14px] font-bold text-ink ${wa ? '' : 'col-span-2'}`}>
                  <Icon name="phone" size={17} /> {s.top.call || STORY_DEFAULTS.call}{!wa && `: ${phone}`}
                </a>
              )}
            </div>
          </div>
          <ul className="space-y-1.5 border-t border-line pt-4 text-[13.5px] text-ink/80">
            <li className="flex items-center gap-2"><Icon name="cash" size={16} className="text-brand" /> ক্যাশ অন ডেলিভারি — পণ্য হাতে পেয়ে টাকা দিন</li>
            <li className="flex items-center gap-2"><Icon name="truck" size={16} className="text-brand" /> সারা বাংলাদেশে হোম ডেলিভারি</li>
          </ul>
        </div>
      </section>

      {/* The product's story */}
      {(s.title || blocks.length > 0) && (
        <article className="card space-y-7 p-5 sm:p-8">
          {s.title && <h2 className="text-[1.6rem] font-bold leading-snug sm:text-[2rem]">{s.title}</h2>}
          {blocks.map((b, i) => (
            <section key={i} className="space-y-2.5">
              {b.title && <h3 className="text-[17px] font-bold text-ink">{b.title}</h3>}
              {b.text && <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink/80">{b.text}</p>}
              {b.points.some((p) => p.text) && (
                <ul className="space-y-2.5">
                  {b.points.filter((p) => p.text).map((p, n) => (
                    <li key={n} className="flex gap-2.5 text-[15px] leading-relaxed text-ink/85">
                      <span className="mt-0.5 shrink-0 text-brand">{p.mark || '✔'}</span>
                      <span className="whitespace-pre-line">{p.text}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </article>
      )}

      {video && (
        <section className="mx-auto max-w-3xl">
          <div className="relative aspect-video overflow-hidden rounded-2xl bg-night shadow-lg">
            <iframe src={video} title={`${name} video`} className="absolute inset-0 h-full w-full" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
          </div>
        </section>
      )}

      {/* Big poster photos, one under another, at their own shape */}
      {s.images.length > 0 && (
        <section className="mx-auto max-w-3xl overflow-hidden rounded-2xl shadow-lg">
          {s.images.map((path, i) => {
            const src = imageUrl(path);
            // eslint-disable-next-line @next/next/no-img-element -- posters keep their own height
            return src ? <img key={i} src={src} alt={i === 0 ? name : ''} loading="lazy" decoding="async" className="block h-auto w-full" /> : null;
          })}
        </section>
      )}

      <section id="order" className="mx-auto max-w-2xl scroll-mt-4 space-y-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">{s.order.title || STORY_DEFAULTS.orderTitle}</h2>
          {(s.order.text || STORY_DEFAULTS.orderText) && <p className="mt-1.5 text-[14px] text-muted">{s.order.text || STORY_DEFAULTS.orderText}</p>}
        </div>
        {order}
      </section>

      {faqs.length > 0 && (
        <section className="mx-auto max-w-3xl">
          <h2 className="mb-4 text-center text-2xl font-bold">প্রশ্ন ও উত্তর</h2>
          <div className="divide-y divide-line rounded-2xl border border-line bg-white px-5">
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

      {s.contact.on && phone && (
        <section className="rounded-2xl bg-night px-6 py-9 text-center text-white">
          <h2 className="text-2xl font-bold">{s.contact.title || STORY_DEFAULTS.contactTitle}</h2>
          <p className="mx-auto mt-2 max-w-md text-[14.5px] text-white/75">{s.contact.text || STORY_DEFAULTS.contactText}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <a href={`tel:${phone}`} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-accent px-6 font-bold text-night"><Icon name="phone" size={17} /> {phone}</a>
            {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center gap-2 rounded-xl border-2 border-white/70 px-6 font-bold text-white"><Icon name="whatsapp" size={17} /> WhatsApp</a>}
          </div>
        </section>
      )}
    </div>
  );
}
