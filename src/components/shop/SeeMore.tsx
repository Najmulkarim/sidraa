'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Shows the first `show` list points; "See more" slides the rest open in place
 * and "See less" slides them shut. Nothing opens in a new page.
 */
export function SeeMore({ show, total, children }: { show: number; total: number; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  // Height that shows the first points; a guess until the page has measured it.
  const [cut, setCut] = useState<number | null>(null);
  const [full, setFull] = useState<number | null>(null);
  const [closing, setClosing] = useState(false);
  const long = total > show;

  const measure = useCallback(() => {
    const el = box.current;
    if (!el) return;
    const last = el.querySelectorAll('li')[show - 1];
    if (last) setCut(last.getBoundingClientRect().bottom - el.getBoundingClientRect().top + 4);
    setFull(el.scrollHeight);
  }, [show]);

  useEffect(() => {
    if (!long) return;
    measure();
    const ro = new ResizeObserver(measure);
    if (box.current) ro.observe(box.current.firstElementChild ?? box.current);
    return () => ro.disconnect();
  }, [long, measure]);

  /**
   * "See less": folds the list frame by frame and moves the page with it in the same
   * motion, so the reader comes back up to the list without a jolt (a separate smooth
   * scroll fought the folding and the page snapped when it got shorter).
   */
  function close() {
    const el = box.current;
    const last = el?.querySelectorAll('li')[show - 1];
    if (!el || !last) { setOpen(false); return; }
    const from = el.getBoundingClientRect().height;
    const to = last.getBoundingClientRect().bottom - el.getBoundingClientRect().top + 4;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Longer folds (many photos) take a little longer, so the speed stays gentle.
    const ms = reduce ? 0 : Math.min(800, Math.max(400, 350 + (from - to) * 0.18));
    const root = document.documentElement;
    const anchor = root.style.overflowAnchor;
    root.style.overflowAnchor = 'none'; // the browser's own scroll correction would double ours
    el.style.transition = 'none';
    setClosing(true);
    const start = performance.now();
    let prev = from;
    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
    const step = (now: number) => {
      const t = ms ? Math.min(1, (now - start) / ms) : 1;
      const h = from + (to - from) * ease(t);
      el.style.maxHeight = `${h}px`;
      // Keep the list's top in view below the sticky header while it folds.
      const top = el.getBoundingClientRect().top;
      const header = 140;
      if (top < header) window.scrollBy(0, -Math.min(prev - h, header - top));
      prev = h;
      if (t < 1) requestAnimationFrame(step);
      else {
        el.style.transition = '';
        root.style.overflowAnchor = anchor;
        setClosing(false);
        setOpen(false);
      }
    };
    requestAnimationFrame(step);
  }

  function toggle() {
    measure();
    if (open) close();
    else setOpen(true);
  }

  if (!long) return <>{children}</>;
  const height = open ? (full ?? undefined) : (cut ?? undefined);
  return (
    <div>
      <div
        ref={box}
        className={`relative overflow-hidden transition-[max-height] duration-500 ease-in-out ${cut === null && !open ? 'max-h-[19rem]' : ''}`}
        style={height !== undefined ? { maxHeight: height } : undefined}
      >
        {children}
        <div aria-hidden className={`pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-paper to-transparent transition-opacity duration-300 ${open && !closing ? 'opacity-0' : 'opacity-100'}`} />
      </div>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="mt-2 inline-flex items-center gap-1.5 text-[14px] font-semibold text-brand hover:underline"
      >
        {open && !closing ? 'See less' : 'See more'}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={`transition-transform duration-300 ${open && !closing ? 'rotate-180' : ''}`}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
    </div>
  );
}
