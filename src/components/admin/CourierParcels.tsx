'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { checkOrderPayment } from '@/actions/accounting';
import { Icon } from '@/components/icons';
import { FINISHED, INSIGHT_GROUPS, paidAfterCheck, type InsightRow } from '@/lib/courier-insight';
import { formatDateTime, formatMoney } from '@/lib/format';

type View = 'todo' | 'done' | 'all';
const LABEL = Object.fromEntries(INSIGHT_GROUPS.map((g) => [g.key, g])) as Record<InsightRow['group'], (typeof INSIGHT_GROUPS)[number]>;

/** Every parcel, with a payment check for each finished one (who checked it and when). */
export function CourierParcels({ rows, name, checked, unchecked }: { rows: InsightRow[]; name: string; checked: number; unchecked: number }) {
  const [view, setView] = useState<View>(unchecked > 0 ? 'todo' : 'all');
  const finished = (r: InsightRow) => FINISHED.includes(r.group);
  const shown = rows.filter((r) => (view === 'all' ? true : view === 'done' ? finished(r) && r.payment_checked_at : finished(r) && !r.payment_checked_at));
  const tabs: { key: View; label: string; count: number }[] = [
    { key: 'todo', label: 'Not checked', count: unchecked },
    { key: 'done', label: 'Checked', count: checked },
    { key: 'all', label: 'All parcels', count: rows.length },
  ];

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
        <div>
          <h2 className="font-semibold">Payment check</h2>
          <p className="text-[12.5px] text-muted">Match each parcel with {name}&apos;s panel, correct the cash if the customer paid less, then press Check.</p>
        </div>
        <div className="inline-flex rounded-xl bg-soft p-1 text-[13px] font-semibold" role="tablist">
          {tabs.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={view === t.key} onClick={() => setView(t.key)}
              className={`rounded-lg px-3 py-1.5 transition ${view === t.key ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'}`}>
              {t.label} <span className={`ml-1 rounded-md px-1.5 text-[11.5px] ${t.key === 'todo' && t.count > 0 ? 'bg-warn/15 text-warn' : 'bg-white/70 text-muted'}`}>{t.count}</span>
            </button>
          ))}
        </div>
      </div>
      {shown.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted">
          {view === 'todo' ? (rows.length ? 'Every finished parcel is checked.' : `No ${name} parcels in this period.`) : 'Nothing here.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-[13.5px]">
            <thead className="bg-soft text-left text-[11.5px] font-bold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2.5">Order</th>
                <th className="px-4 py-2.5">Consignment ID</th>
                <th className="px-4 py-2.5">Handed over</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Charge</th>
                <th className="px-4 py-2.5 text-right">COD fee</th>
                <th className="px-4 py-2.5">Collected · check</th>
              </tr>
            </thead>
            <tbody>{shown.map((r) => <Row key={r.id} r={r} />)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Row({ r }: { r: InsightRow }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [amount, setAmount] = useState(String(r.collected));
  const [err, setErr] = useState<string | null>(null);
  const finished = FINISHED.includes(r.group);
  const noCash = r.group === 'regular_return';

  const save = (checked: boolean) => {
    const collected = Number(amount);
    if (checked && !noCash && (!Number.isFinite(collected) || collected < 0)) { setErr('Enter the cash collected'); return; }
    setErr(null);
    start(async () => {
      const res = await checkOrderPayment(r.id, paidAfterCheck(r, noCash ? 0 : collected), checked);
      if (!res.ok) setErr(res.message ?? 'Could not save');
      else router.refresh();
    });
  };

  return (
    <tr className={`border-t border-line/70 ${r.payment_checked_at ? 'bg-ok/[0.04]' : ''}`}>
      <td className="px-4 py-2.5"><Link href={`/admin/orders/${r.id}`} className="font-semibold text-brand hover:underline">{r.public_ref}</Link></td>
      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[12.5px] text-ink/85 select-all">{r.courier_consignment_id ?? '—'}</td>
      <td className="whitespace-nowrap px-4 py-2.5 text-muted">{formatDateTime(r.courier_sent_at)}</td>
      <td className="px-4 py-2.5">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: LABEL[r.group].color }} aria-hidden />
          {LABEL[r.group].label}
        </span>
      </td>
      <td className="whitespace-nowrap px-4 py-2.5 text-right">{r.fee ? formatMoney(-r.fee) : '—'}</td>
      <td className="whitespace-nowrap px-4 py-2.5 text-right">{r.codFee ? <>{formatMoney(-r.codFee)}{r.codFeeEstimated && <span className="text-muted" title="Estimate: about 1%">*</span>}</> : '—'}</td>
      <td className="px-4 py-2">
        {!finished ? (
          <span className="text-muted">{formatMoney(r.toCollect)} to collect · on the road</span>
        ) : r.payment_checked_at ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1 rounded-md bg-ok/12 px-2 py-0.5 font-semibold text-ok">
              <Icon name="check" size={14} /> {formatMoney(r.collected)} checked
            </span>
            <span className="text-[12px] text-muted">{r.payment_checked_by_name ?? 'Staff'} · {formatDateTime(r.payment_checked_at)}</span>
            <button type="button" disabled={busy} onClick={() => save(false)} className="text-[12px] font-semibold text-muted underline hover:text-ink disabled:opacity-50">Undo</button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {noCash ? (
              <span className="text-muted">Nothing collected</span>
            ) : (
              <label className="inline-flex items-center gap-1">
                <span className="text-muted">৳</span>
                <input inputMode="decimal" aria-label={`Cash collected for ${r.public_ref}`} value={amount} onChange={(e) => setAmount(e.target.value)}
                  className="input h-9 w-28 px-2 py-1 text-right" />
              </label>
            )}
            <button type="button" disabled={busy} onClick={() => save(true)} className="btn btn-primary btn-sm inline-flex items-center gap-1 disabled:opacity-50">
              <Icon name="check" size={14} /> {busy ? 'Saving…' : 'Check'}
            </button>
            {err && <span className="text-[12px] text-bad">{err}</span>}
          </div>
        )}
      </td>
    </tr>
  );
}
