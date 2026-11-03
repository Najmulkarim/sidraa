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

  function toggle() {
    measure();
    if (open) {
      // Closing: bring the page back up to the list, so the reader is not left far below it.
      const top = box.current?.getBoundingClientRect().top ?? 0;
      if (top < 190) window.scrollTo({ top: window.scrollY + top - 190, behavior: 'smooth' });
    }
    setOpen((o) => !o);
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
        <div aria-hidden className={`pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-paper to-transparent transition-opacity duration-300 ${open ? 'opacity-0' : 'opacity-100'}`} />
      </div>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="mt-2 inline-flex items-center gap-1.5 text-[14px] font-semibold text-brand hover:underline"
      >
        {open ? 'See less' : 'See more'}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={`transition-transform duration-300 ${open ? 'rotate-180' : ''}`}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
    </div>
  );
}
