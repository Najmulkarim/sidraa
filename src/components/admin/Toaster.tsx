'use client';

import { useEffect, useState } from 'react';
import { Icon } from '../icons';

type Toast = { id: number; ok: boolean; text: string };
const EVENT = 'sidraa:toast';

/** Shows a popup from anywhere in the admin: green for done, red for a problem. */
export function notify(ok: boolean, text?: string | null) {
  if (typeof window === 'undefined') return;
  const msg = text?.trim() || (ok ? 'Done.' : 'Something went wrong.');
  window.dispatchEvent(new CustomEvent<Omit<Toast, 'id'>>(EVENT, { detail: { ok, text: msg } }));
}

/** Popup stack in the top-right corner (top, full width on phones). Mounted once in the admin layout. */
export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    let n = 0;
    const on = (e: Event) => {
      const { ok, text } = (e as CustomEvent<Omit<Toast, 'id'>>).detail;
      const id = ++n;
      setToasts((t) => [...t.filter((x) => x.text !== text), { id, ok, text }].slice(-3));
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ok ? 4000 : 7000);
    };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-3 top-3 z-[100] flex flex-col items-stretch gap-2 sm:inset-x-auto sm:right-5 sm:top-5 sm:w-96">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.ok ? 'status' : 'alert'}
          className={`pointer-events-auto flex animate-[toast-in_.35s_cubic-bezier(.2,.9,.3,1.2)] items-start gap-3 rounded-2xl px-4 py-3.5 text-white shadow-[0_18px_40px_-12px_rgba(0,0,0,.45)] ring-1 ring-white/20 ${t.ok ? 'bg-[#16a34a]' : 'bg-[#dc2626]'}`}
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/20">
            <Icon name={t.ok ? 'check' : 'x'} size={18} />
          </span>
          <p className="flex-1 pt-1 text-[14.5px] font-semibold leading-snug">{t.text}</p>
          <button type="button" aria-label="Close" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} className="grid h-7 w-7 shrink-0 place-items-center rounded-full hover:bg-white/20">
            <Icon name="x" size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}
