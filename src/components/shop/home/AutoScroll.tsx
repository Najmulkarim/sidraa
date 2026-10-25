'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../../icons';

/**
 * A sideways row that moves on by one item every few seconds, loops back to
 * the start, and stops while the visitor hovers, touches or focuses it (and
 * for anyone who asked for reduced motion). Arrows on wider screens.
 */
export function AutoScroll({ children, autoplay = true, interval = 3500, label }: { children: ReactNode; autoplay?: boolean; interval?: number; label: string }) {
  const row = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  function step(dir: 1 | -1) {
    const el = row.current;
    const first = el?.firstElementChild as HTMLElement | null;
    if (!el || !first) return;
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
    const by = first.offsetWidth + gap;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
    if (dir === 1 && atEnd) el.scrollTo({ left: 0, behavior: 'smooth' });
    else if (dir === -1 && el.scrollLeft <= 4) el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' });
    else el.scrollBy({ left: dir * by, behavior: 'smooth' });
  }

  useEffect(() => {
    if (!autoplay || paused) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => step(1), interval);
    return () => clearInterval(t);
  }, [autoplay, paused, interval]);

  return (
    <div
      className="group/auto relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div ref={row} role="region" aria-label={label} className="-mx-4 flex snap-x scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 [&>:first-child]:ms-auto [&>:last-child]:me-auto [scrollbar-width:none] md:mx-0 md:scroll-px-0 md:px-0 [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
      <button type="button" onClick={() => step(-1)} aria-label="Previous" className="absolute -left-4 top-[38%] hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-card text-ink opacity-0 shadow-lg ring-1 ring-line transition hover:text-brand group-hover/auto:opacity-100 md:grid">
        <Icon name="arrow" size={18} className="rotate-180" />
      </button>
      <button type="button" onClick={() => step(1)} aria-label="Next" className="absolute -right-4 top-[38%] hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-card text-ink opacity-0 shadow-lg ring-1 ring-line transition hover:text-brand group-hover/auto:opacity-100 md:grid">
        <Icon name="arrow" size={18} />
      </button>
    </div>
  );
}
