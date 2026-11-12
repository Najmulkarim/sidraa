'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Fragment, useState, useTransition } from 'react';
import { setItemCost } from '@/actions/accounting';
import { Icon } from '@/components/icons';
import { COURIER_LABEL, type CourierName } from '@/lib/courier/types';
import { formatDateTime, formatMoney } from '@/lib/format';
import type { CostRow } from '@/lib/order-costs';

const SHOW = 50;

/**
 * Every order the statement counted in this period, with what it added to
 * income and to costs, so a wrong figure can be found and corrected: item costs
 * right here, the courier's charge and COD fee in the courier's payment check.
 */
export function AccountingOrders({ rows, totals }: { rows: CostRow[]; totals: { income: number; productCost: number; courierCharge: number; codFee: number; net: number } }) {
  const [open, setOpen] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const found = needle ? rows.filter((r) => r.public_ref.toLowerCase().includes(needle)) : rows;
  const shown = all || needle ? found : found.slice(0, SHOW);
  const flagged = rows.filter((r) => r.missingCost > 0 || r.chargeMissing).length;

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-tint text-brand"><Icon name="note" size={17} /></span>
          <div>
            <h2 className="font-semibold leading-tight">Order by order</h2>
            <p className="text-[12px] text-muted">
              What each order added to the statement above. Click an order&apos;s product cost to correct it.
              {flagged > 0 && <span className="font-semibold text-warn"> {flagged} order{flagged === 1 ? ' needs' : 's need'} a look.</span>}
            </p>
          </div>
        </div>
        <label className="relative w-full sm:w-56">
          <span className="sr-only">Find an order</span>
          <Icon name="search" size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Order no." className="input h-9 w-full py-1 pl-8 text-[13px]" />
        </label>
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted">No delivered or returned orders in this period.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-[13px]">
            <thead className="bg-soft text-left text-[11px] font-bold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2.5">Order</th>
                <th className="px-3 py-2.5">Counted</th>
                <th className="px-3 py-2.5 text-right">Income</th>
                <th className="px-3 py-2.5 text-right">Product cost</th>
                <th className="px-3 py-2.5 text-right">Courier charge</th>
                <th className="px-3 py-2.5 text-right">COD fee</th>
                <th className="px-4 py-2.5 text-right">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/70">
              {shown.map((r) => (
                <Fragment key={r.id}>
                  <tr className={`transition hover:bg-soft/50 ${open === r.id ? 'bg-soft/60' : ''}`}>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <Link href={`/admin/orders/${r.id}`} className="font-mono font-bold hover:text-brand">{r.public_ref}</Link>
                      <span className={`ml-2 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold ${r.status === 'delivered' ? 'bg-ok/12 text-ok' : r.income > 0 ? 'bg-[#fde2e4] text-[#b4233f]' : 'bg-bad/10 text-bad'}`}>
                        {r.status === 'delivered' ? 'Delivered' : r.income > 0 ? 'Paid return' : 'Return'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted">{formatDateTime(r.counted_at)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">{formatMoney(r.income)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">
                      {r.status === 'delivered' ? (
                        <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id}
                          className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium underline decoration-dotted underline-offset-4 hover:bg-tint ${r.missingCost ? 'text-warn' : ''}`}>
                          {r.missingCost > 0 && <Icon name="note" size={12} />}
                          {formatMoney(-r.productCost)}
                        </button>
                      ) : <span className="text-muted">—</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">
                      <FixLink row={r}>
                        <span className={r.chargeMissing ? 'text-warn' : ''}>{r.chargeMissing ? 'not set' : r.courierCharge ? formatMoney(-r.courierCharge) : '—'}</span>
                      </FixLink>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">
                      <FixLink row={r}>
                        {r.codFee ? <>{formatMoney(-r.codFee)}{r.codFromRate && <span className="text-muted" title="Worked out from the COD fee rate; check it to save the exact fee">*</span>}</> : '—'}
                      </FixLink>
                    </td>
                    <td className={`whitespace-nowrap px-4 py-2.5 text-right font-semibold ${r.net < 0 ? 'text-bad' : 'text-ok'}`}>{formatMoney(r.net)}</td>
                  </tr>
                  {open === r.id && (
                    <tr className="bg-soft/40">
                      <td colSpan={7} className="px-4 pb-4 pt-1">
                        <ItemCosts row={r} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-line bg-white font-bold">
              <tr>
                <td className="px-4 py-2.5" colSpan={2}>{needle ? `${found.length} found` : `Total · ${rows.length} order${rows.length === 1 ? '' : 's'}`}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right">{formatMoney(totals.income)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right">{formatMoney(-totals.productCost)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right">{formatMoney(-totals.courierCharge)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right">{formatMoney(-totals.codFee)}</td>
                <td className={`whitespace-nowrap px-4 py-2.5 text-right ${totals.net < 0 ? 'text-bad' : 'text-ok'}`}>{formatMoney(totals.net)}</td>
              </tr>
            </tfoot>
          </table>
          {!all && !needle && found.length > SHOW && (
            <button type="button" onClick={() => setAll(true)} className="w-full border-t border-line py-2.5 text-[13px] font-semibold text-brand hover:bg-soft">
              Show all {found.length} orders
            </button>
          )}
          <p className="border-t border-line px-5 py-2.5 text-[12px] text-muted">
            Totals before your own expenses (ads, salaries…) — those are in the statement. * COD fee worked out from the rate; checking the parcel in the courier tab saves the exact fee.
          </p>
        </div>
      )}
    </section>
  );
}

/** Courier figures are corrected in the courier tab's payment check, opened on this order. */
function FixLink({ row, children }: { row: CostRow; children: React.ReactNode }) {
  if (!row.courier || !row.courier_consignment_id) return <>{children}</>;
  const name = COURIER_LABEL[row.courier as CourierName] ?? row.courier;
  return (
    <Link href={`/admin/accounting/courier/${row.courier}?view=all&q=${encodeURIComponent(row.public_ref)}`} title={`Correct in ${name} payment check`}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 underline decoration-dotted underline-offset-4 hover:bg-tint">
      {children}
    </Link>
  );
}

/** The order's pieces and what each cost; a wrong cost is corrected here. */
function ItemCosts({ row }: { row: CostRow }) {
  return (
    <div className="rounded-xl border border-line bg-white p-3">
      <p className="mb-2 text-[12px] font-semibold text-muted">Cost of each piece in {row.public_ref}</p>
      <ul className="space-y-2">
        {row.items.map((i) => <ItemCost key={i.id} item={i} />)}
      </ul>
    </div>
  );
}

function ItemCost({ item }: { item: CostRow['items'][number] }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [value, setValue] = useState(item.unit_cost === null || item.unit_cost === undefined ? '' : String(Number(item.unit_cost)));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const save = () => {
    const cost = Number(value);
    if (value.trim() === '' || !Number.isFinite(cost) || cost < 0) { setMsg({ ok: false, text: 'Enter a cost (0 or more)' }); return; }
    start(async () => {
      const r = await setItemCost(item.id, cost);
      setMsg({ ok: r.ok, text: r.message ?? '' });
      if (r.ok) router.refresh();
    });
  };
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px]">
      <span className="min-w-0 flex-1">
        {item.quantity} × {item.product_name}{item.variant_label ? <span className="text-muted"> ({item.variant_label})</span> : ''}
      </span>
      <label className="inline-flex items-center gap-1">
        <span className="text-muted">৳</span>
        <input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="not set" aria-label={`Cost of one ${item.product_name}`}
          className="input h-8 w-24 px-2 py-1 text-right" />
        <span className="text-[12px] text-muted">a piece</span>
      </label>
      <button type="button" disabled={busy} onClick={save} className="btn btn-primary btn-sm disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button>
      {msg && <span className={`text-[12px] ${msg.ok ? 'text-ok' : 'text-bad'}`}>{msg.text}</span>}
    </li>
  );
}
