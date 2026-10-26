'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { deleteExpense, reapplyCosts, saveExpense } from '@/actions/accounting';
import { CATEGORY_KEYS, EXPENSE_CATEGORIES, PAID_VIA, type ExpenseCategory, type PaidVia } from '@/lib/accounting';
import { formatTaka } from '@/lib/format';
import type { ActionState } from '@/lib/types';
import { Icon } from '../icons';
import { notify } from './Toaster';

export type Expense = { id: string; spent_on: string; category: ExpenseCategory; amount: number | string; paid_via: PaidVia; reference: string | null; note: string | null };

const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const blank = (today: string) => ({ id: '', spentOn: today, category: 'advertising' as ExpenseCategory, amount: '', paidVia: 'cash' as PaidVia, reference: '', note: '' });

/** Add / edit / delete expenses; the list shows the chosen period. */
export function ExpenseManager({ expenses, today }: { expenses: Expense[]; today: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveExpense, { ok: false });
  const [f, setF] = useState(blank(today));
  const [busy, start] = useTransition();
  const set = (patch: Partial<typeof f>) => setF((cur) => ({ ...cur, ...patch }));

  useEffect(() => {
    if (!state.message) return;
    notify(state.ok, state.message);
    if (state.ok) setF((cur) => ({ ...blank(today), spentOn: cur.spentOn, category: cur.category, paidVia: cur.paidVia }));
  }, [state, today]);

  function edit(e: Expense) {
    setF({ id: e.id, spentOn: e.spent_on, category: e.category, amount: String(Number(e.amount)), paidVia: e.paid_via, reference: e.reference ?? '', note: e.note ?? '' });
    document.getElementById('expense-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function remove(e: Expense) {
    if (!window.confirm(`Delete this ${EXPENSE_CATEGORIES[e.category].label.toLowerCase()} expense of ${formatTaka(e.amount)}?`)) return;
    start(async () => {
      const r = await deleteExpense(e.id);
      notify(r.ok, r.message);
    });
  }

  return (
    <div className="space-y-4">
      <form id="expense-form" action={action} className="card scroll-mt-24 space-y-3 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold">{f.id ? 'Edit expense' : 'Add an expense'}</h3>
          {f.id && <button type="button" onClick={() => setF(blank(today))} className="text-[13px] text-muted underline">Cancel editing</button>}
        </div>
        <input type="hidden" name="id" value={f.id} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="field"><label className="label" htmlFor="ex-date">Date</label><input id="ex-date" name="spentOn" type="date" required max={today} value={f.spentOn} onChange={(e) => set({ spentOn: e.target.value })} className="input" /></div>
          <div className="field">
            <label className="label" htmlFor="ex-cat">Category</label>
            <select id="ex-cat" name="category" value={f.category} onChange={(e) => set({ category: e.target.value as ExpenseCategory })} className="input">
              {CATEGORY_KEYS.map((k) => <option key={k} value={k}>{EXPENSE_CATEGORIES[k].label}</option>)}
            </select>
          </div>
          <div className="field"><label className="label" htmlFor="ex-amount">Amount ৳</label><input id="ex-amount" name="amount" inputMode="decimal" required value={f.amount} onChange={(e) => set({ amount: e.target.value.replace(/[^\d.]/g, '') })} placeholder="0" className="input" /></div>
          <div className="field">
            <label className="label" htmlFor="ex-via">Paid via</label>
            <select id="ex-via" name="paidVia" value={f.paidVia} onChange={(e) => set({ paidVia: e.target.value as PaidVia })} className="input">
              {Object.entries(PAID_VIA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
        <p className="text-[12px] text-muted">{EXPENSE_CATEGORIES[f.category].hint}.{f.category === 'other' ? '' : ' Do not enter stock you buy for selling here — that is counted from each product’s cost price when it sells.'}</p>
        <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
          <div className="field"><label className="label" htmlFor="ex-ref">Reference (optional)</label><input id="ex-ref" name="reference" maxLength={80} value={f.reference} onChange={(e) => set({ reference: e.target.value })} placeholder="Invoice / TrxID" className="input" /></div>
          <div className="field"><label className="label" htmlFor="ex-note">Note (optional)</label><input id="ex-note" name="note" maxLength={300} value={f.note} onChange={(e) => set({ note: e.target.value })} placeholder="e.g. Facebook ads — October campaign" className="input" /></div>
        </div>
        <button disabled={pending} className="btn btn-primary btn-sm">{pending ? 'Saving…' : f.id ? 'Save changes' : '+ Add expense'}</button>
      </form>

      <div className="card overflow-hidden">
        {expenses.length === 0 ? (
          <p className="p-6 text-center text-[14px] text-muted">No expenses in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead className="bg-soft text-left text-[12px] uppercase tracking-wide text-muted">
                <tr><th className="px-4 py-2.5">Date</th><th className="px-4 py-2.5">Category</th><th className="px-4 py-2.5">Note</th><th className="px-4 py-2.5">Paid via</th><th className="px-4 py-2.5 text-right">Amount</th><th className="no-print px-2 py-2.5" /></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {expenses.map((e) => (
                  <tr key={e.id} className={f.id === e.id ? 'bg-tint' : ''}>
                    <td className="whitespace-nowrap px-4 py-2.5">{day.format(new Date(`${e.spent_on}T00:00:00Z`))}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-medium">{EXPENSE_CATEGORIES[e.category]?.label ?? e.category}</td>
                    <td className="max-w-72 px-4 py-2.5 text-ink/75">{e.note}{e.reference && <span className="block text-[12px] text-muted">Ref: {e.reference}</span>}</td>
                    <td className="px-4 py-2.5">{PAID_VIA[e.paid_via] ?? e.paid_via}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold">{formatTaka(e.amount)}</td>
                    <td className="no-print whitespace-nowrap px-2 py-2.5 text-right">
                      <button type="button" onClick={() => edit(e)} className="btn btn-ghost btn-sm px-2" aria-label="Edit expense"><Icon name="pencil" size={14} /></button>
                      <button type="button" disabled={busy} onClick={() => remove(e)} className="btn btn-ghost btn-sm px-2 text-bad" aria-label="Delete expense"><Icon name="trash" size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/** Re-applies today's cost prices to the delivered sales of the period. */
export function ReapplyCosts({ from, to }: { from: string; to: string }) {
  const [busy, start] = useTransition();
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        if (!window.confirm('Use the current cost prices for every item delivered in this period? Use this after fixing a wrong or missing cost price.')) return;
        start(async () => {
          const r = await reapplyCosts(from, to);
          notify(r.ok, r.message);
        });
      }}
      className="btn btn-outline btn-sm"
    >
      <Icon name="refresh" size={14} /> {busy ? 'Updating…' : 'Recalculate with current cost prices'}
    </button>
  );
}

export function PrintButton() {
  return <button type="button" onClick={() => window.print()} className="no-print btn btn-outline btn-sm"><Icon name="printer" size={14} /> Print / PDF</button>;
}
