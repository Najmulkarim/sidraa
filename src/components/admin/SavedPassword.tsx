'use client';

import { useState, useTransition } from 'react';
import { revealStaffPassword } from '@/actions/admin-settings';
import { formatDateTime } from '@/lib/format';
import { Icon } from '../icons';

/** "Saved password: ●●●●●●  👁  Copy": the eye asks the server (super admin only) for it. */
export function SavedPassword({ userId }: { userId: string }) {
  const [shown, setShown] = useState<{ password: string; setAt?: string } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const toggle = () => {
    if (shown) { setShown(null); return; }
    start(async () => {
      const r = await revealStaffPassword(userId);
      if (r.ok && r.password) { setShown({ password: r.password, setAt: r.setAt }); setNote(null); }
      else setNote(r.message ?? 'Not available.');
    });
  };
  const copy = async () => {
    if (!shown) return;
    try { await navigator.clipboard.writeText(shown.password); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
  };

  return (
    <div className="mt-1.5 rounded-lg bg-soft px-2.5 py-1.5 text-[12px]">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-muted">Saved password:</span>
        <span className={shown ? 'select-all font-mono font-semibold text-ink' : 'tracking-widest text-ink/60'}>{shown ? shown.password : '●●●●●●●●'}</span>
        <button type="button" onClick={toggle} disabled={pending} aria-label={shown ? 'Hide saved password' : 'Show saved password'} title={shown ? 'Hide' : 'Show'} className="grid h-6 w-6 place-items-center rounded-full text-muted hover:bg-white hover:text-brand">
          <Icon name="eye" size={14} className={shown ? 'text-brand' : ''} />
        </button>
        {shown && <button type="button" onClick={copy} className="font-semibold text-muted hover:text-ink">{copied ? 'Copied ✓' : 'Copy'}</button>}
      </div>
      {shown?.setAt && <p className="text-[11px] text-muted">Set {formatDateTime(shown.setAt)}</p>}
      {note && <p className="text-[11px] text-warn">{note}</p>}
    </div>
  );
}
