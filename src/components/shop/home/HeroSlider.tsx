'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../icons';
import { ProductImage } from '../ProductImage';

type Slide = { image: string | null; title: string; subtitle: string; button: string; link: string };

/**
 * Photo banner slider: swipes on phones (scroll snap), arrows on wider
 * screens, dots, and moves on by itself every 5 s until the visitor touches it.
 */
export function HeroSlider({ slides }: { slides: Slide[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  function go(n: number) {
    const el = track.current;
    if (!el) return;
    const next = (n + slides.length) % slides.length;
    el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
    setI(next);
  }

  useEffect(() => {
    if (paused || slides.length < 2) return;
    const t = setInterval(() => go(i + 1), 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, paused, slides.length]);

  return (
    <section className="group relative overflow-hidden bg-night" aria-roledescription="carousel" aria-label="Featured" onPointerDown={() => setPaused(true)} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div
        ref={track}
        onScroll={(e) => {
          const el = e.currentTarget;
          const n = Math.round(el.scrollLeft / el.clientWidth);
          if (n !== i && slides[n]) setI(n);
        }}
        className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((s, n) => {
          const body = (
            <>
              <ProductImage path={s.image} alt={s.title || 'Banner'} sizes="100vw" priority={n === 0} />
              {(s.title || s.subtitle || s.button) && (
                <span className="absolute inset-0 flex items-end bg-[linear-gradient(0deg,rgba(15,10,25,0.65),transparent_60%)] p-5 text-white md:items-center md:bg-[linear-gradient(90deg,rgba(15,10,25,0.6),transparent_60%)] md:p-14">
                  <span className="max-w-lg space-y-2 md:space-y-4">
                    {s.title && <span className="block font-display text-[clamp(1.6rem,4.5vw,3.4rem)] font-semibold leading-[1.08]">{s.title}</span>}
                    {s.subtitle && <span className="block text-[14px] text-white/90 md:text-[16px]">{s.subtitle}</span>}
                    {s.button && <span className="btn btn-light mt-1 inline-flex">{s.button}</span>}
                  </span>
                </span>
              )}
            </>
          );
          return (
            <div key={n} className="relative aspect-[4/3] w-full shrink-0 snap-center sm:aspect-[16/7] lg:aspect-[21/8]" aria-roledescription="slide" aria-label={`${n + 1} of ${slides.length}`}>
              {s.link ? <Link href={s.link} className="block h-full w-full">{body}</Link> : body}
            </div>
          );
        })}
      </div>
      {slides.length > 1 && (
        <>
          <button type="button" onClick={() => { setPaused(true); go(i - 1); }} aria-label="Previous banner" className="absolute left-4 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-ink opacity-0 shadow transition group-hover:opacity-100 md:grid">
            <Icon name="arrow" size={20} className="rotate-180" />
          </button>
          <button type="button" onClick={() => { setPaused(true); go(i + 1); }} aria-label="Next banner" className="absolute right-4 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-ink opacity-0 shadow transition group-hover:opacity-100 md:grid">
            <Icon name="arrow" size={20} />
          </button>
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {slides.map((_, n) => (
              <button key={n} type="button" onClick={() => { setPaused(true); go(n); }} aria-label={`Banner ${n + 1}`} aria-current={n === i} className={`h-2 rounded-full transition-all ${n === i ? 'w-6 bg-white' : 'w-2 bg-white/50'}`} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
