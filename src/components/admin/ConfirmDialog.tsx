'use client';

import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon, type IconName } from '../icons';

/** The site's own "are you sure?" popup (not the browser's), for deleting and similar steps. */
export function ConfirmDialog({ open, title, children, confirmLabel, cancelLabel = 'Cancel', pendingLabel = 'Working…', icon = 'trash', danger = true, pending = false, onConfirm, onClose }: {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  pendingLabel?: string;
  icon?: IconName;
  danger?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !pending) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, pending, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-night/50 p-4 backdrop-blur-sm" role="alertdialog" aria-modal="true" aria-label={title} onClick={() => !pending && onClose()}>
      <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 text-left shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <span className={`grid h-12 w-12 place-items-center rounded-full ${danger ? 'bg-bad/10 text-bad' : 'bg-tint text-brand'}`}><Icon name={icon} size={22} /></span>
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          {children && <div className="mt-1 text-sm text-muted">{children}</div>}
        </div>
        {/* Long labels wrap inside the box instead of running out of it. */}
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={pending} onClick={onClose} autoFocus className="btn btn-outline h-auto min-h-11 flex-1 whitespace-normal py-2 leading-tight">{cancelLabel}</button>
          <button type="button" disabled={pending} onClick={onConfirm} className={`btn h-auto min-h-11 flex-[2] whitespace-normal py-2 leading-tight ${danger ? 'bg-bad text-white hover:opacity-90' : 'btn-primary'}`}>{pending ? pendingLabel : confirmLabel}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
