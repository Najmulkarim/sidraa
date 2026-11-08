'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { deleteLanding, setLandingActive } from '@/actions/admin-landing';
import { Icon } from '../icons';
import { ConfirmDialog } from './ConfirmDialog';
import { notify } from './Toaster';

/** Copy link / View / Edit / Delete for one landing page in the list. */
export function LandingRowActions({ id, slug, active }: { id: string; slug: string; active: boolean }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [pending, start] = useTransition();
  const [on, setOn] = useState(active);
  const [switching, startSwitch] = useTransition();
  const btn = 'grid h-9 w-9 place-items-center rounded-full border border-line hover:border-brand hover:text-brand';
  return (
    <span className="flex items-center gap-1.5">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={on ? 'Turn this landing page off' : 'Turn this landing page on'}
        title={on ? 'ON — click to turn off' : 'OFF — click to turn on'}
        disabled={switching}
        onClick={() => startSwitch(async () => { const next = !on; setOn(next); const r = await setLandingActive(id, next); notify(r.ok, r.message); if (!r.ok) setOn(!next); router.refresh(); })}
        className="mr-1 inline-flex items-center gap-2 rounded-full border border-line px-2 py-1 text-[12px] font-bold disabled:opacity-60"
      >
        <span className={`relative block h-5 w-9 shrink-0 rounded-full transition ${on ? 'bg-ok' : 'bg-line'}`}>
          <span className={`absolute left-0 top-0.5 block h-4 w-4 rounded-full bg-white shadow transition ${on ? 'translate-x-[1.125rem]' : 'translate-x-0.5'}`} />
        </span>
        <span className={on ? 'text-ok' : 'text-muted'}>{on ? 'ON' : 'OFF'}</span>
      </button>
      <button
        type="button"
        title="Click to copy the link (for your Facebook ad)"
        onClick={async () => {
          const url = `${window.location.origin}/offer/${slug}`;
          try { await navigator.clipboard.writeText(url); notify(true, `Link copied: ${url}`); }
          catch { notify(false, 'Could not copy — the browser blocked it.'); }
        }}
        className="mr-1 inline-flex max-w-[16rem] cursor-copy items-center gap-1.5 truncate rounded-full border border-line px-3 py-1.5 font-mono text-[12px] text-muted hover:border-brand hover:text-brand"
      >
        <span className="truncate">/offer/{slug}</span> <Icon name="copy" size={13} />
      </button>
      <a href={`/offer/${slug}`} target="_blank" rel="noreferrer" title="View on website" aria-label="View on website" className={btn}><Icon name="eye" size={15} /></a>
      <Link href={`/admin/landing-pages/${id}`} title="Edit" aria-label="Edit" className={btn}><Icon name="pencil" size={15} /></Link>
      <button type="button" onClick={() => setAsking(true)} title="Delete" aria-label="Delete" className="grid h-9 w-9 place-items-center rounded-full border border-line text-bad hover:border-bad hover:bg-bad/10"><Icon name="trash" size={15} /></button>
      <ConfirmDialog
        open={asking}
        title="Delete this landing page?"
        confirmLabel="Yes, delete"
        pendingLabel="Deleting…"
        pending={pending}
        onClose={() => setAsking(false)}
        onConfirm={() => start(async () => { const r = await deleteLanding(id); notify(r.ok, r.message); setAsking(false); router.refresh(); })}
      >
        The link stops working. The product and its orders are not touched.
      </ConfirmDialog>
    </span>
  );
}
