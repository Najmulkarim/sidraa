'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { blockPhone, quickBlock } from '@/actions/admin-customers';
import { formatDateTime, formatTaka } from '@/lib/format';
import type { ActionState } from '@/lib/types';
import { Icon } from '../icons';
import { FieldError, FormMessage, PendingButton, useKeepValuesAction } from './ui';
import { notify } from './Toaster';

export type CustomerRow = {
  phone: string; name: string; district: string; orders: number; delivered: number; returned: number; cancelled: number;
  spent: number | string; last_order_at: string; blocked: boolean; block_reason: string | null;
};

export function CustomersTable({ rows }: { rows: CustomerRow[] }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<ActionState | null>(null);
  const toggle = (r: CustomerRow) =>
    start(async () => {
      const reason = r.blocked ? null : 'Blocked from the customers list';
      const res = await quickBlock(r.phone, reason, !r.blocked);
      setMsg(res);
      notify(res.ok, res.message);
      router.refresh();
    });

  return (
    <>
      {msg && <FormMessage state={msg} />}
      <div className="overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full min-w-[860px] text-[13px]">
          <thead className="border-b border-line bg-soft text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
            <tr><th className="px-3 py-3">Customer</th><th className="px-3 py-3 text-right">Orders</th><th className="px-3 py-3 text-right">Delivered</th><th className="px-3 py-3 text-right">Returned / lost</th><th className="px-3 py-3 text-right">Cancelled / fake</th><th className="px-3 py-3 text-right">Spent</th><th className="px-3 py-3">Last order</th><th className="px-3 py-3 text-right">Block</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={8} className="py-14 text-center text-muted">No customers match.</td></tr>}
            {rows.map((r) => {
              const finished = r.delivered + r.returned + r.cancelled;
              const pct = finished ? Math.round((r.delivered / finished) * 100) : null;
              return (
                <tr key={r.phone} className={`border-b border-line last:border-0 ${r.blocked ? 'bg-[#fee2e2]/40' : ''}`}>
                  <td className="px-3 py-3">
                    <p className="font-semibold">{r.name} {r.blocked && <span className="badge badge-bad ml-1">Blocked</span>}</p>
                    <p className="font-mono text-[12px]"><a href={`tel:${r.phone}`} className="hover:text-brand">{r.phone}</a> <span className="text-muted">· {r.district}</span></p>
                    {r.blocked && r.block_reason && <p className="text-[11.5px] text-bad">{r.block_reason}</p>}
                  </td>
                  <td className="px-3 py-3 text-right"><Link href={`/admin/customers/${r.phone}`} className="font-semibold text-brand hover:underline">{r.orders}</Link></td>
                  <td className="px-3 py-3 text-right">{r.delivered}{pct !== null && <span className={`ml-1 text-[11px] font-semibold ${pct >= 80 ? 'text-ok' : pct >= 50 ? 'text-warn' : 'text-bad'}`}>{pct}%</span>}</td>
                  <td className="px-3 py-3 text-right">{r.returned}</td>
                  <td className="px-3 py-3 text-right">{r.cancelled}</td>
                  <td className="px-3 py-3 text-right font-mono">{formatTaka(r.spent)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-muted">{formatDateTime(r.last_order_at)}</td>
                  <td className="px-3 py-3 text-right">
                    <button type="button" disabled={busy} onClick={() => toggle(r)} className={`btn btn-sm ${r.blocked ? 'btn-outline' : 'btn-ghost text-bad'}`}>
                      <Icon name={r.blocked ? 'restore' : 'ban'} size={14} /> {r.blocked ? 'Unblock' : 'Block'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Block a number that has not ordered yet (e.g. a known prank caller). */
export function BlockForm() {
  const { state, onSubmit, pending } = useKeepValuesAction(blockPhone);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-[12rem_1fr_auto] sm:items-end" noValidate>
      <div className="field">
        <label htmlFor="bl-phone" className="label">Mobile number</label>
        <input id="bl-phone" name="phone" inputMode="tel" maxLength={20} className="input" placeholder="01XXXXXXXXX" />
        <FieldError state={state} name="phone" />
      </div>
      <div className="field">
        <label htmlFor="bl-reason" className="label">Reason (staff only)</label>
        <input id="bl-reason" name="reason" maxLength={200} className="input" placeholder="e.g. Refused 3 parcels" />
      </div>
      <PendingButton pending={pending} className="btn btn-outline btn-sm min-h-11">Block number</PendingButton>
      <div className="sm:col-span-3"><FormMessage state={state} /></div>
    </form>
  );
}
