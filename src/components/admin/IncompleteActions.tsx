'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { deleteIncomplete, setIncompleteStatus } from '@/actions/admin-incomplete';
import { Icon } from '../icons';
import { notify } from './Toaster';

/** Make order / Cancel / Delete for one incomplete order; delete asks first in the site's own popup. */
export function IncompleteActions({ id, status, canConvert, name, onEdit }: { id: string; status: 'open' | 'converted' | 'cancelled'; canConvert: boolean; name: string; onEdit?: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (!asking) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAsking(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [asking]);

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) => start(async () => {
    const r = await fn();
    notify(r.ok, r.message);
    setAsking(false);
    router.refresh();
  });

  return (
    <div className="flex items-center gap-1.5 lg:justify-end">
      {status !== 'converted' && canConvert && (
        <Link href={`/admin/orders/new?draft=${id}`} className="btn btn-primary btn-sm whitespace-nowrap px-3"><Icon name="cart" size={14} /> Make order</Link>
      )}
      {onEdit && <button type="button" disabled={pending} onClick={onEdit} className="btn btn-outline btn-sm px-3"><Icon name="pencil" size={14} /> Edit</button>}
      {status === 'open' && (
        <button type="button" disabled={pending} onClick={() => run(() => setIncompleteStatus(id, 'cancelled'))} title="Cancel — keep it, but off the open list" aria-label="Cancel" className="btn btn-outline btn-sm px-3"><Icon name="ban" size={14} /><span className="hidden sm:inline"> Cancel</span></button>
      )}
      {status === 'cancelled' && (
        <button type="button" disabled={pending} onClick={() => run(() => setIncompleteStatus(id, 'open'))} className="btn btn-outline btn-sm px-3"><Icon name="restore" size={14} /> Reopen</button>
      )}
      <button type="button" disabled={pending} onClick={() => setAsking(true)} title="Delete" aria-label={`Delete ${name}`} className="ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-full text-bad hover:bg-bad/10 lg:ml-0"><Icon name="trash" size={16} /></button>

      {asking && createPortal(
        <div className="fixed inset-0 z-50 grid place-items-center bg-night/50 p-4 backdrop-blur-sm" role="alertdialog" aria-modal="true" aria-labelledby={`del-inc-${id}`} onClick={() => !pending && setAsking(false)}>
          <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 text-left shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <span className="grid h-12 w-12 place-items-center rounded-full bg-bad/10 text-bad"><Icon name="trash" size={22} /></span>
            <div>
              <h2 id={`del-inc-${id}`} className="text-lg font-bold">Delete {name}?</h2>
              <p className="mt-1 text-sm text-muted">This incomplete order is removed for good. To keep it but take it off the list, use Cancel.</p>
            </div>
            <div className="flex gap-2">
              <button type="button" disabled={pending} onClick={() => setAsking(false)} autoFocus className="btn btn-outline flex-1">Cancel</button>
              <button type="button" disabled={pending} onClick={() => run(() => deleteIncomplete(id))} className="btn flex-1 bg-bad text-white hover:opacity-90">{pending ? 'Deleting…' : 'Yes, delete'}</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
