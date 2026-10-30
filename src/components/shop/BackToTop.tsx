'use client';

import { useEffect, useState } from 'react';
import { Icon } from '../icons';

/** Round "back to top" button after scrolling down a screen or two. */
export function BackToTop({ raised, aboveChat = false }: { raised: boolean; aboveChat?: boolean }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const on = () => setShow(window.scrollY > 900);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return (
    <button
      type="button"
      aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      style={aboveChat ? { marginBottom: '4.5rem' } : undefined}
      className={`fixed right-4 z-20 grid h-11 w-11 place-items-center rounded-full bg-night text-white shadow-lg transition duration-300 hover:bg-brand ${raised ? 'bottom-[calc(5.25rem+env(safe-area-inset-bottom))] md:bottom-6' : 'bottom-6'} ${show ? 'opacity-100' : 'pointer-events-none translate-y-3 opacity-0'}`}
    >
      <Icon name="arrow" size={18} className="-rotate-90" />
    </button>
  );
}
