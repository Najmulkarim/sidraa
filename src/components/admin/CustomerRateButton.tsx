'use client';

import { useEffect, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { getCustomerHistory, type CustomerHistory } from '@/actions/admin-customer-history';
import { successPercent, type CourierRow } from '@/lib/courier/history';
import { Icon } from '../icons';

const tone = (pct: number | null) => (pct === null ? 'text-muted' : pct >= 80 ? 'text-ok' : pct >= 50 ? 'text-warn' : 'text-bad');

function Rows({ rows, summary }: { rows: CourierRow[]; summary?: CourierRow }) {
  const cell = 'px-2 py-1.5 text-right font-mono';
  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-muted">
          <th className="px-2 py-1.5">Courier</th><th className="px-2 py-1.5 text-right">Total</th><th className="px-2 py-1.5 text-right">Delivered</th><th className="px-2 py-1.5 text-right">Failed</th><th className="px-2 py-1.5 text-right">Rate</th>
        </tr>
      </thead>
      <tbody>
        {[...rows, ...(summary ? [summary] : [])].map((r) => {
          const pct = successPercent(r);
          return (
            <tr key={r.name} className={`border-b border-line/60 last:border-0 ${r === summary ? 'font-bold' : ''}`}>
              <td className="px-2 py-1.5 capitalize">{r.name}</td>
              <td className={cell}>{r.total}</td><td className={cell}>{r.delivered}</td><td className={cell}>{r.failed}</td>
              <td className={`${cell} font-semibold ${tone(pct)}`}>{pct === null ? '—' : `${pct}%`}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** The % beside a customer's phone. Clicking shows how many parcels they took with each courier. */
export function CustomerRateButton({ phone, name, text, tone: textTone, title }: { phone: string; name: string; text: string; tone: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<CustomerHistory | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  function show() {
    setOpen(true);
    setData(null);
    start(async () => {
      try {
        setData(await getCustomerHistory(phone));
      } catch (e) {
        console.error('[admin] customer history', e);
        setData({ ok: false, message: 'Could not load this customer. Reload the page and try again.' });
      }
    });
  }

  return (
    <>
      <button type="button" onClick={show} title={title} className={`font-semibold underline decoration-dotted underline-offset-2 hover:opacity-70 ${textTone}`}>{text}</button>
      {open && createPortal(
        <div className="fixed inset-0 z-50 grid place-items-center bg-night/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby={`rate-${phone}`} onClick={() => setOpen(false)}>
          <div className="max-h-[90dvh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl bg-white p-6 text-left font-sans shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id={`rate-${phone}`} className="text-lg font-bold">Delivery record</h2>
                <p className="text-sm text-muted">{name} · <span className="font-mono">{phone}</span></p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-lg border border-line hover:border-brand"><Icon name="x" size={16} /></button>
            </div>

            {pending || !data ? (
              <p className="py-8 text-center text-sm text-muted">Loading…</p>
            ) : !data.ok ? (
              <p className="rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad">{data.message}</p>
            ) : (
              <>
                <section className="space-y-1.5">
                  <h3 className="text-[13px] font-semibold">All shops, by courier</h3>
                  {data.all ? (
                    data.all.couriers.length ? <Rows rows={data.all.couriers} summary={data.all.summary} /> : <p className="text-sm text-muted">No parcels found for this number with any courier.</p>
                  ) : (
                    <p className="rounded-lg bg-soft px-3 py-2 text-[12.5px] text-muted">
                      {data.external === 'failed' ? 'Could not reach BD Courier just now. Try again in a little while.' : 'Not connected yet. Add the BD Courier API key to show this.'}
                    </p>
                  )}
                </section>
                <section className="space-y-1.5">
                  <h3 className="text-[13px] font-semibold">Orders from this shop ({data.own?.total ?? 0})</h3>
                  {data.own?.couriers.length ? <Rows rows={data.own.couriers} /> : <p className="text-sm text-muted">None sent to a courier yet.</p>}
                  {!!data.own?.pickupCancelled && <p className="text-[12.5px] text-muted">{data.own.pickupCancelled} pickup cancelled: not counted, the parcel never left the shop.</p>}
                </section>
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
