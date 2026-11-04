'use client';

import { useTransition } from 'react';
import { refreshCatalogNow } from '@/actions/admin-catalog-feed';
import { Icon } from '../icons';
import { notify } from './Toaster';

/** Products page: send the latest products to the Facebook catalog after listing. Only a popup says how it went. */
export function RefreshCatalogButton() {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      title="Update the Facebook catalog with your latest products"
      onClick={() => start(async () => {
        const r = await refreshCatalogNow();
        notify(r.ok, r.ok ? 'Facebook catalog refreshed.' : r.message);
      })}
      className="btn btn-outline btn-sm h-11"
    >
      <Icon name="refresh" size={15} /> {pending ? 'Refreshing…' : 'Refresh Facebook catalog'}
    </button>
  );
}
