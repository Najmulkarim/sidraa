'use client';

import { useState, useTransition } from 'react';
import { refreshCatalogNow } from '@/actions/admin-catalog-feed';
import type { ActionState } from '@/lib/types';
import { CopyField } from './SecretInput';
import { notify } from './Toaster';

/** Settings → Facebook: product feed link, Refresh now, and the optional feed ID + token for instant updates. */
export function CatalogFeedCard({ feedUrl, lastAt, lastResult }: { feedUrl: string; lastAt: string | null; lastResult: string | null }) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<ActionState | null>(null);

  return (
    <section className="card space-y-4 p-5">
      <div>
        <h2 className="font-semibold">Facebook catalog</h2>
        <p className="text-[13px] text-muted">Your products for Facebook &amp; Instagram shops and dynamic ads. It refreshes by itself once a day; press the button after listing new products.</p>
      </div>
      <CopyField label="Product feed link (Commerce Manager → Data sources → Data feed → Scheduled feed)" value={feedUrl} />
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={pending} onClick={() => start(async () => { const r = await refreshCatalogNow(); setRes(r); notify(r.ok, r.message); })} className="btn btn-primary btn-sm">
          {pending ? 'Refreshing…' : 'Refresh catalog now'}
        </button>
        {res && <span role="status" className={res.ok ? 'text-sm text-ok' : 'text-sm text-bad'}>{res.message}</span>}
      </div>
      {lastAt && <p className="text-[12.5px] text-muted">Last sent {new Date(lastAt).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka' })}: {lastResult}</p>}

      <p className="text-[12.5px] text-muted">Feed ID and catalog token (optional) are saved with the Facebook settings above.</p>
    </section>
  );
}
