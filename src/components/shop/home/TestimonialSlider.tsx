'use client';

import { useEffect, useState } from 'react';
import { Icon } from '../../icons';

type Review = { quote: string; name: string; place: string; rating: number };

/** One customer comment at a time; moves on every 7 s, arrows and dots to switch. */
export function TestimonialSlider({ items }: { items: Review[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || items.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % items.length), 7000);
    return () => clearInterval(t);
  }, [paused, items.length]);
  const r = items[i]!;
  const go = (d: number) => { setPaused(true); setI((n) => (n + d + items.length) % items.length); };

  return (
    <div className="relative flex h-full flex-col items-center justify-center rounded-2xl bg-cream px-12 py-8 text-center" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <p className="text-[15px] tracking-[0.2em] text-brand" aria-label={`${r.rating} out of 5 stars`}>{'★'.repeat(r.rating)}<span className="text-line">{'★'.repeat(5 - r.rating)}</span></p>
      <span className="mt-2 font-display text-5xl leading-none text-brand/40" aria-hidden="true">“</span>
      <blockquote key={i} className="animate-[fade-in_0.4s_ease-out] font-display text-[1.35rem] font-medium leading-snug text-night">{r.quote}</blockquote>
      <p className="mt-4 text-[13px] font-medium uppercase tracking-[0.18em] text-ink/70">— {r.name}{r.place ? `, ${r.place}` : ''}</p>
      {items.length > 1 && (
        <>
          <button type="button" onClick={() => go(-1)} aria-label="Previous review" className="absolute left-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-card shadow ring-1 ring-line hover:text-brand"><Icon name="arrow" size={16} className="rotate-180" /></button>
          <button type="button" onClick={() => go(1)} aria-label="Next review" className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-card shadow ring-1 ring-line hover:text-brand"><Icon name="arrow" size={16} /></button>
          <div className="mt-5 flex gap-1.5">
            {items.map((_, n) => <button key={n} type="button" onClick={() => { setPaused(true); setI(n); }} aria-label={`Review ${n + 1}`} aria-current={n === i} className={`h-1.5 rounded-full transition-all ${n === i ? 'w-6 bg-night' : 'w-1.5 bg-night/25'}`} />)}
          </div>
        </>
      )}
    </div>
  );
}
