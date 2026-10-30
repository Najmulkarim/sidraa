'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { importProduct } from '@/actions/admin-import';
import { bookmarkletHref } from '@/lib/import/bookmarklet';
import { Icon } from '../icons';
import { notify } from './Toaster';

/** React refuses a javascript: link in JSX, so the bookmark's address is set directly. */
function SendBookmark() {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    ref.current?.setAttribute('href', bookmarkletHref(window.location.origin));
  }, []);
  return (
    <a ref={ref} draggable onClick={(e) => e.preventDefault()} className="btn btn-primary btn-sm cursor-grab">Send to Sidraa</a>
  );
}

/** Products toolbar: paste a product link; the product opens as a Draft to finish by hand. */
export function ImportProductButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState('');
  const [error, setError] = useState<string | null>(null);
  // The site refused our server: ask for the page source from the browser instead.
  const [blocked, setBlocked] = useState(false);
  const [source, setSource] = useState('');
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !pending) setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, pending]);

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      try {
        const r = await importProduct(link, blocked && source.trim() ? source : undefined);
        if (r.ok && r.values?.productId) {
          notify(true, r.message);
          router.push(`/admin/products/${r.values.productId}`);
        } else {
          setError(r.message ?? 'Could not import that page.');
          if (r.values?.blocked) setBlocked(true);
        }
      } catch (err) {
        console.error('[admin] import', err);
        setError('Could not import that page. Reload and try again.');
      }
    });
  }

  return (
    <>
      <button type="button" onClick={() => { setOpen(true); setError(null); setLink(''); setBlocked(false); setSource(''); }} className="btn btn-outline btn-sm h-11">
        <Icon name="plus" size={15} /> Import
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-50 grid place-items-center bg-night/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="import-title" onClick={() => !pending && setOpen(false)}>
          <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div>
              <h2 id="import-title" className="text-lg font-bold">Import a product</h2>
              <p className="mt-1 text-sm text-muted">Paste the product page link. Name, description, photos and variations are copied as a Draft, hidden from customers until you check and publish it.</p>
            </div>
            <div className="field">
              <label htmlFor="import-link" className="label">Product link</label>
              <input id="import-link" type="url" required autoFocus value={link} onChange={(e) => { setLink(e.target.value); setBlocked(false); setSource(''); }} disabled={pending} placeholder="https://…" className="input" />
            </div>
            {blocked && (
              <div className="space-y-2 rounded-xl border border-line bg-soft p-3">
                <p className="text-[13px] font-semibold">Easiest: a one-click button</p>
                <ol className="list-decimal space-y-0.5 pl-5 text-[12.5px] text-muted">
                  <li>Press <kbd className="rounded border border-line bg-white px-1">Ctrl</kbd> + <kbd className="rounded border border-line bg-white px-1">Shift</kbd> + <kbd className="rounded border border-line bg-white px-1">B</kbd> to show your bookmarks bar.</li>
                  <li>Drag this button up to the bar (once only): <SendBookmark /></li>
                  <li>On any product page, click it in the bar, then press Import.</li>
                </ol>
              </div>
            )}
            {blocked && (
              <div className="field">
                <label htmlFor="import-source" className="label">Or paste the page source</label>
                <ol className="mb-2 list-decimal space-y-0.5 pl-5 text-[12.5px] text-muted">
                  <li>Open the product link in a new tab.</li>
                  <li>Press <kbd className="rounded border border-line bg-soft px-1">Ctrl</kbd> + <kbd className="rounded border border-line bg-soft px-1">U</kbd>. A page of code opens.</li>
                  <li>Press <kbd className="rounded border border-line bg-soft px-1">Ctrl</kbd> + <kbd className="rounded border border-line bg-soft px-1">A</kbd>, then <kbd className="rounded border border-line bg-soft px-1">Ctrl</kbd> + <kbd className="rounded border border-line bg-soft px-1">C</kbd>.</li>
                  <li>Paste it below and press Import.</li>
                </ol>
                <textarea id="import-source" required rows={4} value={source} onChange={(e) => setSource(e.target.value)} disabled={pending} placeholder="Paste here" className="input font-mono text-[12px]" />
              </div>
            )}
            {error && <p role="alert" className="rounded-lg bg-bad/10 px-3 py-2 text-[13px] text-bad">{error}</p>}
            <p className="text-[12px] text-muted">Check the photos and text before publishing. Import only what you are allowed to sell, and do not use another shop’s photos without permission.</p>
            <div className="flex gap-2">
              <button type="button" disabled={pending} onClick={() => setOpen(false)} className="btn btn-outline flex-1">Cancel</button>
              <button type="submit" disabled={pending || !link.trim() || (blocked && !source.trim())} className="btn btn-primary flex-1">{pending ? 'Importing…' : 'Import'}</button>
            </div>
          </form>
        </div>,
        document.body,
      )}
    </>
  );
}
