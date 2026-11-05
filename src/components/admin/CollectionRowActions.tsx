'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { deleteCollection } from '@/actions/admin-collections';
import { Icon } from '../icons';
import { ConfirmDialog } from './ConfirmDialog';
import { notify } from './Toaster';

/** View / Edit / Delete for one collection in the list. */
export function CollectionRowActions({ id, name, slug }: { id: string; name: string; slug: string }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [pending, start] = useTransition();
  const btn = 'grid h-9 w-9 place-items-center rounded-full border border-line hover:border-brand hover:text-brand';
  return (
    <span className="flex items-center gap-1.5">
      <a href={`/collections/${slug}`} target="_blank" rel="noreferrer" title="View on website" aria-label={`View ${name} on the website`} className={btn}><Icon name="eye" size={15} /></a>
      <Link href={`/admin/collections/${id}`} title="Edit" aria-label={`Edit ${name}`} className={btn}><Icon name="pencil" size={15} /></Link>
      <button type="button" onClick={() => setAsking(true)} title="Delete" aria-label={`Delete ${name}`} className="grid h-9 w-9 place-items-center rounded-full border border-line text-bad hover:border-bad hover:bg-bad/10"><Icon name="trash" size={15} /></button>
      <ConfirmDialog
        open={asking}
        title={`Delete “${name}”?`}
        confirmLabel="Yes, delete"
        pendingLabel="Deleting…"
        pending={pending}
        onClose={() => setAsking(false)}
        onConfirm={() => start(async () => { const r = await deleteCollection(id); notify(r.ok, r.message); setAsking(false); router.refresh(); })}
      >
        Its page and home page sections stop showing it. The products are not touched.
      </ConfirmDialog>
    </span>
  );
}
