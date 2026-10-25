'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ProductImage } from '../ProductImage';

export type HeroSlide = { image: string | null; title: string; subtitle: string; button: string; link: string };

/**
 * Split hero: text on the left, a tall photo on the right, on the blush
 * cream background. Several slides cross-fade every 6 s (paused while the
 * pointer is over it); dots switch by hand.
 */
export function HeroLuxury({ slides, eyebrow, secondary }: { slides: HeroSlide[]; eyebrow: string; secondary: { label: string; href: string } | null }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || slides.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % slides.length), 6000);
    return () => clearInterval(t);
  }, [paused, slides.length]);

  return (
    <section className="relative overflow-hidden bg-cream" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} aria-roledescription="carousel" aria-label="Featured">
      <span className="pointer-events-none absolute -right-24 top-1/4 h-[28rem] w-[28rem] rounded-full bg-[color-mix(in_oklab,var(--brand)_10%,transparent)] blur-3xl" aria-hidden="true" />
      <div className="container-page relative grid min-h-[30rem] md:grid-cols-2 md:items-center lg:min-h-[34rem]">
        {slides.map((s, n) => (
          <div
            key={n}
            className={`col-start-1 row-start-1 grid gap-6 transition-opacity duration-700 md:col-span-2 md:grid-cols-2 md:items-center ${n === i ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
            aria-hidden={n !== i}
          >
            <div className="order-2 space-y-5 pb-10 md:order-1 md:py-16">
              <p className="text-[12px] font-medium uppercase tracking-[0.28em] text-brand-ink">{eyebrow}</p>
              {/* One <h1> per page: the first slide's title; the others are h2. */}
              {(() => {
                const Tag = n === 0 ? 'h1' : 'h2';
                return <Tag className="font-display text-[clamp(2.6rem,5.6vw,4.4rem)] font-semibold leading-[1.02] text-night">{s.title}</Tag>;
              })()}
              {s.subtitle && <p className="max-w-sm text-[15.5px] leading-relaxed text-ink/75">{s.subtitle}</p>}
              <div className="flex flex-wrap gap-3 pt-1">
                <Link href={s.link || '/products'} tabIndex={n === i ? 0 : -1} className="btn btn-primary px-7">{s.button || 'Shop collection'}</Link>
                {secondary && <Link href={secondary.href} tabIndex={n === i ? 0 : -1} className="btn btn-dark-outline px-7">{secondary.label}</Link>}
              </div>
            </div>
            <div className="relative order-1 -mx-4 aspect-[4/5] max-h-[26rem] overflow-hidden md:order-2 md:mx-0 md:max-h-none md:self-stretch md:aspect-auto md:min-h-[30rem] lg:min-h-[34rem]">
              <ProductImage path={s.image} alt={s.title} sizes="(min-width: 768px) 50vw, 100vw" priority={n === 0} className="object-[center_20%]" />
              <span className="absolute inset-0 bg-[linear-gradient(90deg,var(--cream),transparent_25%)] max-md:bg-[linear-gradient(0deg,var(--cream),transparent_30%)]" aria-hidden="true" />
            </div>
          </div>
        ))}
      </div>
      {slides.length > 1 && (
        <div className="absolute inset-x-0 bottom-4 flex justify-center gap-2 md:justify-start md:pl-[max(1rem,calc((100vw-78rem)/2+1.5rem))]">
          {slides.map((_, n) => (
            <button key={n} type="button" onClick={() => { setI(n); setPaused(true); }} aria-label={`Slide ${n + 1}`} aria-current={n === i} className={`h-1.5 rounded-full transition-all ${n === i ? 'w-8 bg-night' : 'w-3 bg-night/25'}`} />
          ))}
        </div>
      )}
    </section>
  );
}
