'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Icon } from '../../icons';

/** Nova hero: the slides sit on top of each other and fade; dots and an arrow; moves on every 6 s until touched. */
export function NovaSlides({ slides }: { slides: ReactNode[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = slides.length;

  useEffect(() => {
    if (paused || n < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), 6000);
    return () => clearInterval(t);
  }, [paused, n]);

  return (
    <section className="relative grid overflow-hidden bg-[var(--nova-ink)]" aria-roledescription="carousel" aria-label="Featured" onPointerDown={() => setPaused(true)} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      {slides.map((s, k) => (
        <div key={k} className={`[grid-area:1/1] transition-opacity duration-700 ${k === i ? 'opacity-100' : 'pointer-events-none opacity-0'}`} aria-hidden={k !== i} aria-roledescription="slide">
          {s}
        </div>
      ))}
      {n > 1 && (
        <>
          <button type="button" onClick={() => { setPaused(true); setI((i + 1) % n); }} aria-label="Next banner" className="absolute right-4 top-1/2 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/40 text-white transition hover:bg-white hover:text-[var(--nova-ink)] md:grid">
            <Icon name="arrow" size={18} />
          </button>
          <div className="absolute bottom-4 right-6 flex gap-1.5">
            {slides.map((_, k) => (
              <button key={k} type="button" onClick={() => { setPaused(true); setI(k); }} aria-label={`Banner ${k + 1}`} aria-current={k === i} className={`h-2 rounded-full transition-all ${k === i ? 'w-6 bg-[var(--nova)]' : 'w-2 bg-white/50'}`} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/** "Our favourites": tabs that swap between product rows rendered on the server. */
export function NovaTabs({ head, tabs }: { head: ReactNode; tabs: { label: string; content: ReactNode }[] }) {
  const [i, setI] = useState(0);
  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        {head}
        {tabs.length > 1 && (
          <div role="tablist" className="flex gap-5 border-b border-line">
            {tabs.map((t, k) => (
              <button key={k} type="button" role="tab" aria-selected={k === i} onClick={() => setI(k)} className={`-mb-px border-b-2 pb-2 text-[12px] font-semibold uppercase tracking-[0.14em] transition ${k === i ? 'border-[var(--nova)] text-[var(--nova-ink)]' : 'border-transparent text-ink/50 hover:text-[var(--nova-ink)]'}`}>
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {tabs.map((t, k) => <div key={k} role="tabpanel" hidden={k !== i}>{t.content}</div>)}
    </>
  );
}
