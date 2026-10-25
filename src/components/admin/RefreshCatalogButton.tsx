'use client';

import { useState, useTransition } from 'react';
import { refreshCatalogNow } from '@/actions/admin-catalog-feed';
import { Icon } from '../icons';

/** Products page: send the latest products to the Facebook catalog after listing. */
export function RefreshCatalogButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <>
      <button type="button" disabled={pending} title="Update the Facebook catalog with your latest products" onClick={() => start(async () => { const r = await refreshCatalogNow(); setMsg({ ok: r.ok, text: r.message ?? '' }); })} className="btn btn-outline btn-sm h-11">
        <Icon name="refresh" size={15} /> {pending ? 'Refreshing…' : 'Refresh Facebook catalog'}
      </button>
      {msg && <p role="status" className={`basis-full text-[12.5px] ${msg.ok ? 'text-ok' : 'text-bad'}`}>{msg.text}</p>}
    </>
  );
}
