'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../icons';

/** Bin icon that asks first; the variation leaves the form only after "Yes, delete". */
export function RemoveVariationButton({ name, saved, disabled, onConfirm }: { name: string; saved: boolean; disabled?: boolean; onConfirm: () => void }) {
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (!asking) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAsking(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [asking]);

  const label = `Delete ${name}`;
  return (
    <>
      <button
        type="button"
        title={disabled ? 'A product needs at least one variation' : label}
        aria-label={label}
        disabled={disabled}
        onClick={() => setAsking(true)}
        className="grid h-9 w-9 place-items-center rounded-full text-bad transition hover:bg-bad/10 disabled:cursor-not-allowed disabled:opacity-30"
      >
        <Icon name="trash" size={18} />
      </button>
      {/* In the page body: a table row would otherwise clip and restyle it. */}
      {asking && createPortal(
        <div className="fixed inset-0 z-50 grid place-items-center bg-night/50 p-4 backdrop-blur-sm" role="alertdialog" aria-modal="true" aria-labelledby="del-var-title" onClick={() => setAsking(false)}>
          <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 text-left shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <span className="grid h-12 w-12 place-items-center rounded-full bg-bad/10 text-bad"><Icon name="trash" size={22} /></span>
            <div>
              <h2 id="del-var-title" className="text-lg font-bold">Delete {name}?</h2>
              <p className="mt-1 text-sm text-muted">
                {saved
                  ? <>It is deleted when you press <b>Save</b>. If it is in any order, it is hidden instead, so old orders stay correct. To only hide it for now, use the eye button.</>
                  : 'This new variation is removed from the form.'}
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setAsking(false)} autoFocus className="btn btn-outline flex-1">Cancel</button>
              <button type="button" onClick={() => { setAsking(false); onConfirm(); }} className="btn flex-1 bg-bad text-white hover:opacity-90">Yes, delete</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
