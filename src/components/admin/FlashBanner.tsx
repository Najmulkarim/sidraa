'use client';

import { useEffect, useState, type ReactNode } from 'react';

/**
 * A notice that fades away by itself after a few seconds (e.g. "Product saved."),
 * and takes its one-time flag out of the address so a reload does not show it again.
 */
export function FlashBanner({ children, className = '', ms = 3000, clear = [] }: { children: ReactNode; className?: string; ms?: number; clear?: string[] }) {
  const [phase, setPhase] = useState<'shown' | 'fading' | 'gone'>('shown');

  useEffect(() => {
    if (clear.length) {
      const url = new URL(window.location.href);
      clear.forEach((k) => url.searchParams.delete(k));
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    }
    const fade = setTimeout(() => setPhase('fading'), ms);
    const gone = setTimeout(() => setPhase('gone'), ms + 400);
    return () => { clearTimeout(fade); clearTimeout(gone); };
    // Runs once, when the notice first shows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === 'gone') return null;
  return (
    <div role="status" className={`transition-all duration-400 ${phase === 'fading' ? '-translate-y-1 opacity-0' : 'opacity-100'} ${className}`}>
      {children}
    </div>
  );
}
