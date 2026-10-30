'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { importProduct } from '@/actions/admin-import';
import { notify } from './Toaster';

type Incoming = { url: string; source: string };

/**
 * Receives a product page from the "Send to Sidraa" bookmark. Any website could
 * send a message here, so nothing is created until staff press Import.
 */
export function ImportFromBrowser() {
  const router = useRouter();
  const [page, setPage] = useState<Incoming | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const d = e.data as { sidraaImport?: unknown; url?: unknown; source?: unknown } | null;
      if (!d || d.sidraaImport !== 1 || typeof d.url !== 'string' || typeof d.source !== 'string') return;
      setPage({ url: d.url, source: d.source });
      (e.source as Window | null)?.postMessage('sidraa-received', e.origin);
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  function run() {
    if (!page) return;
    setError(null);
    start(async () => {
      try {
        const r = await importProduct(page.url, page.source);
        if (r.ok && r.values?.productId) {
          notify(true, r.message);
          router.push(`/admin/products/${r.values.productId}`);
        } else {
          setError(r.message ?? 'Could not import that page.');
        }
      } catch (err) {
        console.error('[admin] import', err);
        setError('Could not import that page. Reload and try again.');
      }
    });
  }

  let host = '';
  try {
    host = page ? new URL(page.url).hostname : '';
  } catch { /* shown as empty */ }

  return (
    <section className="card mx-auto mt-10 max-w-md space-y-4 p-6">
      <h1 className="text-lg font-bold">Import a product</h1>
      {page ? (
        <>
          <p className="text-sm text-muted">Product received from <b className="text-ink">{host}</b>. It is saved as a Draft, hidden from customers until you check and publish it.</p>
          {error && <p role="alert" className="rounded-lg bg-bad/10 px-3 py-2 text-[13px] text-bad">{error}</p>}
          <button type="button" autoFocus disabled={pending} onClick={run} className="btn btn-primary w-full">{pending ? 'Importing…' : 'Import'}</button>
        </>
      ) : (
        <p className="text-sm text-muted">Waiting for a product. Open a product page and press your “Send to Sidraa” bookmark.</p>
      )}
    </section>
  );
}
