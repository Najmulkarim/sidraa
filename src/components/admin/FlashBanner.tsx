'use client';

import { useEffect, useState, type ReactNode } from 'react';

/**
 * A notice that goes away by itself after a couple of seconds (e.g. "Product saved."):
 * it fades while folding up, and the page below slides up smoothly. Its one-time flag
 * leaves the address too, so a reload does not show it again.
 */
export function FlashBanner({ children, className = '', ms = 2000, clear = [] }: { children: ReactNode; className?: string; ms?: number; clear?: string[] }) {
  const [phase, setPhase] = useState<'shown' | 'closing' | 'gone'>('shown');

  useEffect(() => {
    if (clear.length) {
      const url = new URL(window.location.href);
      clear.forEach((k) => url.searchParams.delete(k));
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    }
    const close = setTimeout(() => setPhase('closing'), ms);
    const gone = setTimeout(() => setPhase('gone'), ms + 350);
    return () => { clearTimeout(close); clearTimeout(gone); };
    // Runs once, when the notice first shows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === 'gone') return null;
  const closing = phase === 'closing';
  return (
    <div
      role="status"
      className="grid transition-[grid-template-rows,opacity] duration-300 ease-out"
      // Folded to zero height, its spacing merges with the next block's, so nothing jumps when it is removed.
      style={{ gridTemplateRows: closing ? '0fr' : '1fr', opacity: closing ? 0 : 1 }}
    >
      <div className="min-h-0 overflow-hidden">
        <div className={className}>{children}</div>
      </div>
    </div>
  );
}
