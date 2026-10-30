'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Storefront } from '@/lib/storefront';
import { Icon } from '../icons';

const SEEN_WELCOME = 'sidraa:popup:welcome';
const SEEN_EXIT = 'sidraa:popup:exit';
const ORDERED = 'sidraa:ordered';
/** Read by the checkout, which fills in the code. */
export const SAVED_COUPON = 'sidraa:coupon';
const EXIT_AGAIN_MS = 7 * 86_400_000;
const WELCOME_DELAY_MS = 1500;
const EXIT_READY_MS = 8000;

/** Storage can be blocked (private windows): then a popup simply may show again. */
function read(store: 'local' | 'session', key: string): string | null {
  try {
    return (store === 'local' ? localStorage : sessionStorage).getItem(key);
  } catch {
    return null;
  }
}
function write(store: 'local' | 'session', key: string, value: string) {
  try {
    (store === 'local' ? localStorage : sessionStorage).setItem(key, value);
  } catch { /* ignore */ }
}

/**
 * Welcome: once per visit, on arrival. Leaving: when the pointer heads out of the
 * window, or on phones a quick scroll back up (a phone gives no earlier sign), at most
 * once a week, never during checkout and never after this browser has placed an order.
 */
export function SitePopups({ popups, exitCode }: { popups: Storefront['popups']; exitCode: string | null }) {
  const path = usePathname();
  const [open, setOpen] = useState<'welcome' | 'exit' | null>(null);
  const [copied, setCopied] = useState(false);
  const openRef = useRef(open);
  openRef.current = open;
  const buying = path.startsWith('/checkout') || path.startsWith('/order');
  const exit = popups.exit;
  const exitOn = exit.enabled && (!exit.code || exitCode === exit.code);

  useEffect(() => {
    if (path.startsWith('/order')) write('local', ORDERED, '1');
  }, [path]);

  useEffect(() => {
    if (!popups.welcome.enabled || buying || read('session', SEEN_WELCOME)) return;
    const t = setTimeout(() => {
      if (openRef.current) return;
      write('session', SEEN_WELCOME, '1');
      setOpen('welcome');
    }, WELCOME_DELAY_MS);
    return () => clearTimeout(t);
  }, [popups.welcome.enabled, buying]);

  useEffect(() => {
    if (!exitOn || buying) return;
    const started = Date.now();
    const allowed = () => {
      if (openRef.current || Date.now() - started < EXIT_READY_MS || read('local', ORDERED)) return false;
      const last = Number(read('local', SEEN_EXIT));
      return !last || Date.now() - last > EXIT_AGAIN_MS;
    };
    const show = () => {
      if (!allowed()) return;
      write('local', SEEN_EXIT, String(Date.now()));
      setOpen('exit');
    };
    const onOut = (e: MouseEvent) => { if (!e.relatedTarget && e.clientY <= 0) show(); };
    let lastY = window.scrollY;
    let lastT = Date.now();
    const onScroll = () => {
      const y = window.scrollY;
      const now = Date.now();
      if (now - lastT > 150) {
        if (lastY - y > 250 && y > 200) show();
        lastY = y;
        lastT = now;
      }
    };
    const touch = window.matchMedia('(pointer: coarse)').matches;
    if (touch) window.addEventListener('scroll', onScroll, { passive: true });
    else document.documentElement.addEventListener('mouseout', onOut);
    return () => {
      window.removeEventListener('scroll', onScroll);
      document.documentElement.removeEventListener('mouseout', onOut);
    };
  }, [exitOn, buying]);

  const close = useCallback(() => setOpen(null), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (!open) return null;
  const p = open === 'welcome' ? popups.welcome : popups.exit;
  const code = open === 'exit' ? popups.exit.code : '';

  async function copy() {
    write('local', SAVED_COUPON, code);
    try {
      await navigator.clipboard.writeText(code);
    } catch { /* clipboard blocked: the code is still on screen and saved for checkout */ }
    setCopied(true);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-night/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="site-popup-title" onClick={close}>
      <div className="relative w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 text-center text-ink shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button type="button" autoFocus onClick={close} aria-label="Close" className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-soft hover:text-ink"><Icon name="x" size={18} /></button>
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-tint text-brand"><Icon name={open === 'welcome' ? 'truck' : 'tag'} size={26} /></span>
        <div>
          <h2 id="site-popup-title" className="font-display text-xl font-bold leading-snug">{p.title}</h2>
          {p.text && <p className="mt-1.5 text-sm text-muted">{p.text}</p>}
        </div>
        {code && (
          <button type="button" onClick={copy} className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand bg-tint/50 px-4 py-3 font-mono text-lg font-bold tracking-wider text-brand">
            {code} <span className="font-sans text-[12px] font-semibold tracking-normal text-muted">{copied ? 'Copied ✓' : 'Tap to copy'}</span>
          </button>
        )}
        <Link href={p.link} onClick={() => { if (code) write('local', SAVED_COUPON, code); close(); }} className="btn btn-primary w-full">{p.button}</Link>
      </div>
    </div>
  );
}
