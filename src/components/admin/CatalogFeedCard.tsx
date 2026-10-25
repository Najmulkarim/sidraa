'use client';

import { useState, useTransition } from 'react';
import { refreshCatalogNow, saveCatalogSettings } from '@/actions/admin-catalog-feed';
import type { ActionState } from '@/lib/types';
import { CopyField, SecretInput } from './SecretInput';
import { FormMessage, PendingButton, useKeepValuesAction } from './ui';
import { notify } from './Toaster';

/** Settings → Facebook: product feed link, Refresh now, and the optional feed ID + token for instant updates. */
export function CatalogFeedCard({ feedUrl, feedId, token, lastAt, lastResult }: { feedUrl: string; feedId: string | null; token: string | null; lastAt: string | null; lastResult: string | null }) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<ActionState | null>(null);
  const { state, onSubmit, pending: saving } = useKeepValuesAction(saveCatalogSettings);

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

      <form onSubmit={onSubmit} className="grid gap-3 border-t border-line pt-4 sm:grid-cols-2" noValidate>
        <p className="text-[13px] text-muted sm:col-span-2">Optional — to send updates to Facebook at once instead of waiting for its schedule: the feed ID (Commerce Manager → Data sources → your feed → Settings) and a system-user token with catalog access.</p>
        <div className="field">
          <label htmlFor="catalogFeedId" className="label">Feed ID</label>
          <input id="catalogFeedId" name="catalogFeedId" defaultValue={feedId ?? ''} inputMode="numeric" className="input font-mono" />
        </div>
        <SecretInput name="catalogToken" label="Access token" saved={token} state={state} />
        <div className="space-y-2 sm:col-span-2">
          <FormMessage state={state} />
          <PendingButton pending={saving} className="btn btn-outline btn-sm">Save</PendingButton>
        </div>
      </form>
    </section>
  );
}
