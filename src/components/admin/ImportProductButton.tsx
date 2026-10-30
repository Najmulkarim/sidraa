'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { importProduct } from '@/actions/admin-import';
import { Icon } from '../icons';
import { notify } from './Toaster';

/** Products toolbar: paste a product link; the product opens as a Draft to finish by hand. */
export function ImportProductButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState('');
  const [error, setError] = useState<string | null>(null);
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
        const r = await importProduct(link);
        if (r.ok && r.values?.productId) {
          notify(true, r.message);
          router.push(`/admin/products/${r.values.productId}`);
        } else {
          setError(r.message ?? 'Could not import that page.');
        }
      } catch (err) {
        console.error('[admin] import', err);
        setError('Could not import that page. Reload and try again.');
      }
    });
  }

  return (
    <>
      <button type="button" onClick={() => { setOpen(true); setError(null); setLink(''); }} className="btn btn-outline btn-sm h-11">
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
              <input id="import-link" type="url" required autoFocus value={link} onChange={(e) => setLink(e.target.value)} disabled={pending} placeholder="https://…" className="input" />
            </div>
            {error && <p role="alert" className="rounded-lg bg-bad/10 px-3 py-2 text-[13px] text-bad">{error}</p>}
            <p className="text-[12px] text-muted">Check the photos and text before publishing. Import only what you are allowed to sell, and do not use another shop’s photos without permission.</p>
            <div className="flex gap-2">
              <button type="button" disabled={pending} onClick={() => setOpen(false)} className="btn btn-outline flex-1">Cancel</button>
              <button type="submit" disabled={pending || !link.trim()} className="btn btn-primary flex-1">{pending ? 'Importing…' : 'Import'}</button>
            </div>
          </form>
        </div>,
        document.body,
      )}
    </>
  );
}
