'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { duplicateOrder } from '@/actions/admin-orders';
import { Icon } from '../icons';
import { notify } from './Toaster';

/** Asks first (a new order holds stock), makes a new order with the same customer and items, then opens it. */
export function DuplicateOrderButton({ id, publicRef, icon = false }: { id: string; publicRef: string; icon?: boolean }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!asking) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAsking(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [asking]);

  function create() {
    start(async () => {
      try {
        const r = await duplicateOrder(id);
        notify(r.ok, r.message);
        setAsking(false);
        if (r.ok && r.values?.orderId) router.push(`/admin/orders/${r.values.orderId}`);
      } catch (e) {
        console.error('[admin] duplicate order', e);
        notify(false, 'Could not duplicate the order. Reload the page and try again.');
        setAsking(false);
      }
    });
  }

  const title = `Duplicate ${publicRef}`;
  return (
    <>
      {icon ? (
        <button type="button" title={title} aria-label={title} disabled={pending} onClick={() => setAsking(true)} className="grid h-8 w-8 place-items-center rounded-lg border border-line text-ink hover:border-brand hover:text-brand disabled:opacity-30">
          <Icon name="copy" size={16} />
        </button>
      ) : (
        <button type="button" title={title} disabled={pending} onClick={() => setAsking(true)} className="btn btn-outline btn-sm">
          <Icon name="copy" size={15} /> Duplicate order
        </button>
      )}
      {/* In the page body: a table row would otherwise clip and restyle it. */}
      {asking && createPortal(
        <div className="fixed inset-0 z-50 grid place-items-center bg-night/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby={`dup-${id}`} onClick={() => !pending && setAsking(false)}>
          <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 text-left shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <span className="grid h-12 w-12 place-items-center rounded-full bg-tint text-brand"><Icon name="copy" size={22} /></span>
            <div>
              <h2 id={`dup-${id}`} className="text-lg font-bold">Duplicate {publicRef}?</h2>
              <p className="mt-1 text-sm text-muted">A new order is created with the same customer, items and prices. It gets a new order number and starts as New.</p>
            </div>
            <div className="flex gap-2">
              <button type="button" disabled={pending} onClick={() => setAsking(false)} className="btn btn-outline flex-1">Cancel</button>
              <button type="button" disabled={pending} onClick={create} autoFocus className="btn btn-primary flex-1">{pending ? 'Creating…' : 'OK, duplicate'}</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
