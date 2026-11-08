'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { deleteLanding } from '@/actions/admin-landing';
import { Icon } from '../icons';
import { ConfirmDialog } from './ConfirmDialog';
import { notify } from './Toaster';

/** Copy link / View / Edit / Delete for one landing page in the list. */
export function LandingRowActions({ id, slug }: { id: string; slug: string }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [pending, start] = useTransition();
  const btn = 'grid h-9 w-9 place-items-center rounded-full border border-line hover:border-brand hover:text-brand';
  return (
    <span className="flex items-center gap-1.5">
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
