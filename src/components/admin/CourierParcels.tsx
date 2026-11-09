'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { checkOrderPayment, checkOrderPayments } from '@/actions/accounting';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { Icon } from '@/components/icons';
import { codFeeAt, FINISHED, INSIGHT_GROUPS, paidAfterCheck, type InsightRow } from '@/lib/courier-insight';
import { formatDateTime, formatMoney } from '@/lib/format';

type View = 'todo' | 'done' | 'all';
const LABEL = Object.fromEntries(INSIGHT_GROUPS.map((g) => [g.key, g])) as Record<InsightRow['group'], (typeof INSIGHT_GROUPS)[number]>;
const nf = new Intl.NumberFormat('en-US');

/** What a Check saves for a parcel as it stands (cash shown, charge shown, COD fee at the parcel's rate). */
function checkValues(r: InsightRow, cash = r.collected, charge = r.fee) {
  const noCash = r.group === 'regular_return';
  const fromRate = r.courier_cod_fee === null || r.courier_cod_fee === undefined || r.courier_cod_fee === '';
  const collected = noCash ? 0 : cash;
  return { orderId: r.id, paid: paidAfterCheck(r, collected), charge, codFee: fromRate ? codFeeAt(collected > 0 ? collected : 0, r.codRate) : r.codFee };
}

/**
 * The payment check: one page of parcels at a time (a month can hold thousands),
 * with a search, Not checked / Checked / All, and "check this whole page" for
 * parcels that already match the courier's panel.
 */
export function CourierParcels({ rows, name, checked, unchecked, all, view, q, page, pages, matched, perPage, basePath, keepRange, canEditChecked = false }: {
  rows: InsightRow[]; name: string; checked: number; unchecked: number; all: number; canEditChecked?: boolean;
  view: View; q: string; page: number; pages: number; matched: number; perPage: number; basePath: string; keepRange: string;
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const href = (p: { view?: View; page?: number; q?: string }) => {
    const v = p.view ?? view;
    const query = p.q ?? q;
    return `${basePath}?${keepRange}&view=${v}${query ? `&q=${encodeURIComponent(query)}` : ''}${(p.page ?? 1) > 1 ? `&page=${p.page}` : ''}`;
  };
  const tabs: { key: View; label: string; count: number }[] = [
    { key: 'todo', label: 'Not checked', count: unchecked },
    { key: 'done', label: 'Checked', count: checked },
    { key: 'all', label: 'All parcels', count: all },
  ];
  const pending = rows.filter((r) => FINISHED.includes(r.group) && !r.payment_checked_at);
  const first = matched ? (page - 1) * perPage + 1 : 0;
  const last = Math.min(matched, page * perPage);

  const checkPage = () => start(async () => {
    const res = await checkOrderPayments(pending.map((r) => checkValues(r)));
    setMsg({ ok: res.ok, text: res.message ?? '' });
    setConfirm(false);
    router.refresh();
  });

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
        <div>
          <h2 className="font-semibold">Payment check</h2>
          <p className="text-[12.5px] text-muted">Match each parcel with {name}&apos;s panel, correct the cash or charge if needed, then press Check.</p>
        </div>
        <nav className="inline-flex rounded-xl bg-soft p-1 text-[13px] font-semibold" aria-label="Payment check views">
          {tabs.map((t) => (
            <Link key={t.key} href={href({ view: t.key })} aria-current={view === t.key ? 'page' : undefined}
              className={`rounded-lg px-3 py-1.5 transition ${view === t.key ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'}`}>
              {t.label} <span className={`ml-1 rounded-md px-1.5 text-[11.5px] ${t.key === 'todo' && t.count > 0 ? 'bg-warn/15 text-warn' : 'bg-white/70 text-muted'}`}>{nf.format(t.count)}</span>
            </Link>
          ))}
        </nav>
      </div>

      {/* Search, where we are, and check the whole page. */}
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-soft/50 px-5 py-2.5">
        <form action={basePath} className="flex min-w-0 flex-1 items-center gap-2" role="search">
          {keepRange.split('&').map((kv) => { const [k, v] = kv.split('='); return <input key={k} type="hidden" name={k} value={decodeURIComponent(v ?? '')} />; })}
          <input type="hidden" name="view" value={view} />
          <label className="relative min-w-0 flex-1 sm:max-w-xs">
            <span className="sr-only">Search order or consignment ID</span>
            <Icon name="search" size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input name="q" defaultValue={q} placeholder="Order no. or consignment ID" className="input h-9 w-full py-1 pl-8 text-[13px]" />
          </label>
          <button type="submit" className="btn btn-sm border border-line bg-white">Search</button>
          {q && <Link href={href({ q: '' }).replace(/&q=[^&]*/, '')} className="text-[12.5px] font-semibold text-muted underline">Clear</Link>}
        </form>
        <p className="text-[12.5px] text-muted">{matched ? <>Showing <b className="text-ink">{nf.format(first)}–{nf.format(last)}</b> of {nf.format(matched)}</> : 'No parcels'}</p>
        {pending.length > 1 && (
          <button type="button" onClick={() => { setMsg(null); setConfirm(true); }} className="btn btn-sm inline-flex items-center gap-1 border border-ok/40 bg-ok/10 text-ok">
            <Icon name="check" size={14} /> Check all {pending.length} on this page
          </button>
        )}
      </div>
      {msg && <p className={`border-b border-line px-5 py-2 text-[13px] ${msg.ok ? 'text-ok' : 'text-bad'}`}>{msg.text}</p>}

      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted">
          {q ? `No parcel matches “${q}”.` : view === 'todo' ? (all ? 'Every finished parcel is checked.' : `No ${name} parcels in this period.`) : 'Nothing here.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-[13.5px]">
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
            <tbody>{rows.map((r) => <Row key={r.id} r={r} canEditChecked={canEditChecked} />)}</tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-3 text-[13px]" aria-label="Pages">
          {page > 1 ? <Link href={href({ page: page - 1 })} className="btn btn-sm border border-line bg-white">← Previous</Link> : <span />}
          <span className="flex flex-wrap items-center gap-1">
            {pageList(page, pages).map((p, i) => p === 0
              ? <span key={`gap${i}`} className="px-1 text-muted">…</span>
              : <Link key={p} href={href({ page: p })} aria-current={p === page ? 'page' : undefined}
                  className={`grid h-8 min-w-8 place-items-center rounded-lg px-2 font-semibold ${p === page ? 'bg-ink text-white' : 'text-muted hover:bg-soft hover:text-ink'}`}>{p}</Link>)}
          </span>
          {page < pages ? <Link href={href({ page: page + 1 })} className="btn btn-sm border border-line bg-white">Next →</Link> : <span />}
        </nav>
      )}

      <ConfirmDialog open={confirm} title={`Check ${pending.length} parcels on this page?`} icon="check" danger={false}
        confirmLabel={`Yes, check ${pending.length}`} cancelLabel="Not now" pending={busy} pendingLabel="Checking…" onConfirm={checkPage} onClose={() => setConfirm(false)}>
        <p>Each is saved with the cash, delivery charge and COD fee shown on its row. Do this only after matching them with {name}&apos;s panel — anything typed into a row but not checked is not used.</p>
      </ConfirmDialog>
    </section>
  );
}

/** Page numbers to show: the first, the last, and two either side of the current one (0 = a gap). */
function pageList(page: number, pages: number): number[] {
  const out: number[] = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 2) out.push(p);
    else if (out[out.length - 1] !== 0) out.push(0);
  }
  return out;
}

function CopyId({ id }: { id: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" title="Copy" aria-label={`Copy ${id}`}
      onClick={async () => { try { await navigator.clipboard.writeText(id); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* clipboard blocked */ } }}
      className={`grid h-7 w-7 shrink-0 place-items-center rounded-md border transition ${done ? 'border-ok/40 bg-ok/10 text-ok' : 'border-line text-muted hover:bg-soft hover:text-ink'}`}>
      <Icon name={done ? 'check' : 'copy'} size={13} />
    </button>
  );
}

function Row({ r, canEditChecked }: { r: InsightRow; canEditChecked: boolean }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [amount, setAmount] = useState(String(r.collected));
  const [charge, setCharge] = useState(String(r.fee));
  const [codInput, setCodInput] = useState(String(r.codFee));
  const [reopened, setReopened] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const finished = FINISHED.includes(r.group);
  const noCash = r.group === 'regular_return';
  const isChecked = !!r.payment_checked_at;
  // A checked payment is locked; a super admin can open it again to correct it.
  const editing = finished && (!isChecked || reopened);
  // First check: the COD fee follows the cash typed in, at the rate of the parcel's day (unless the courier reported it).
  // Editing a checked one: the saved COD fee is shown as its own field.
  const fromRate = !isChecked && (r.courier_cod_fee === null || r.courier_cod_fee === undefined || r.courier_cod_fee === '');
  const cash = Number(amount);
  const codFee = !editing ? r.codFee : reopened ? Number(codInput) : checkValues(r, Number.isFinite(cash) ? cash : 0).codFee;

  const save = (checked: boolean) => {
    const collected = Number(amount);
    const fee = Number(charge);
    if (checked && !noCash && (!Number.isFinite(collected) || collected < 0)) { setErr('Enter the cash collected'); return; }
    if (checked && (charge.trim() === '' || !Number.isFinite(fee) || fee < 0)) { setErr('Enter the delivery charge'); return; }
    if (checked && reopened && (codInput.trim() === '' || !Number.isFinite(codFee) || codFee < 0)) { setErr('Enter the COD fee'); return; }
    setErr(null);
    start(async () => {
      const res = checked
        ? await checkOrderPayment(r.id, paidAfterCheck(r, noCash ? 0 : collected), true, fee, codFee)
        : await checkOrderPayment(r.id, Number(r.paid_amount), false);
      if (!res.ok) setErr(res.message ?? 'Could not save');
      else { setReopened(false); router.refresh(); }
    });
  };

  return (
    <tr className={`border-t border-line/70 ${r.payment_checked_at ? 'bg-ok/[0.04]' : ''}`}>
      <td className="px-4 py-2.5"><Link href={`/admin/orders/${r.id}`} className="font-semibold text-brand hover:underline">{r.public_ref}</Link></td>
      <td className="whitespace-nowrap px-4 py-2">
        {r.courier_consignment_id ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="select-all font-mono text-[12.5px] text-ink/85">{r.courier_consignment_id}</span>
            <CopyId id={r.courier_consignment_id} />
          </span>
        ) : '—'}
      </td>
      <td className="whitespace-nowrap px-4 py-2.5 text-muted">{formatDateTime(r.courier_sent_at)}</td>
      <td className="px-4 py-2.5">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: LABEL[r.group].color }} aria-hidden />
          {LABEL[r.group].label}
        </span>
      </td>
      <td className="whitespace-nowrap px-4 py-2 text-right">
        {editing ? (
          <label className="inline-flex items-center gap-1">
            <span className="text-muted">৳</span>
            <input inputMode="decimal" aria-label={`Delivery charge for ${r.public_ref}`} value={charge} onChange={(e) => setCharge(e.target.value)}
              className="input h-9 w-20 px-2 py-1 text-right" />
          </label>
        ) : r.fee ? formatMoney(-r.fee) : '—'}
      </td>
      <td className="whitespace-nowrap px-4 py-2.5 text-right">
        {reopened ? (
          <label className="inline-flex items-center gap-1">
            <span className="text-muted">৳</span>
            <input inputMode="decimal" aria-label={`COD fee for ${r.public_ref}`} value={codInput} onChange={(e) => setCodInput(e.target.value)}
              className="input h-9 w-20 px-2 py-1 text-right" />
          </label>
        ) : (
          <>
            {codFee ? formatMoney(-codFee) : '—'}
            {editing && fromRate && codFee > 0 && <span className="block text-[11px] text-muted">at {r.codRate}%</span>}
          </>
        )}
      </td>
      <td className="px-4 py-2">
        {!finished ? (
          <span className="text-muted">{formatMoney(r.toCollect)} to collect · on the road</span>
        ) : isChecked && !reopened ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1 rounded-md bg-ok/12 px-2 py-0.5 font-semibold text-ok">
              <Icon name="check" size={14} /> {formatMoney(r.collected)} checked
            </span>
            <span className="text-[12px] text-muted">{r.payment_checked_by_name ?? 'Staff'} · {formatDateTime(r.payment_checked_at)}</span>
            {canEditChecked ? (
              <>
                <button type="button" disabled={busy} onClick={() => { setErr(null); setReopened(true); }} className="text-[12px] font-semibold text-brand underline disabled:opacity-50">Edit</button>
                <button type="button" disabled={busy} onClick={() => save(false)} className="text-[12px] font-semibold text-muted underline hover:text-ink disabled:opacity-50">Undo</button>
              </>
            ) : (
              <span className="inline-flex items-center gap-1 text-[12px] text-muted" title="Only a super admin can change a checked payment"><Icon name="lock" size={12} /> Locked</span>
            )}
            {err && <span className="text-[12px] text-bad">{err}</span>}
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
              <Icon name="check" size={14} /> {busy ? 'Saving…' : reopened ? 'Save' : 'Check'}
            </button>
            {reopened && (
              <button type="button" disabled={busy} onClick={() => { setReopened(false); setErr(null); setAmount(String(r.collected)); setCharge(String(r.fee)); setCodInput(String(r.codFee)); }}
                className="text-[12px] font-semibold text-muted underline">Cancel</button>
            )}
            {err && <span className="text-[12px] text-bad">{err}</span>}
          </div>
        )}
      </td>
    </tr>
  );
}
