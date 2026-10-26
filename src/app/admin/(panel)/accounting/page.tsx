import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { DateRangePicker } from '@/components/admin/DateRangePicker';
import { ExpenseManager, PrintButton, ReapplyCosts, type Expense } from '@/components/admin/ExpenseManager';
import { Icon, type IconName } from '@/components/icons';
import { autoGroup, CATEGORY_KEYS, EXPENSE_CATEGORIES, pnlTotals, type Pnl } from '@/lib/accounting';
import { requirePermission } from '@/lib/auth';
import { addDays, dhakaToday, formatTaka, resolveRange, toNumber } from '@/lib/format';

export const metadata: Metadata = { title: 'Accounting' };

const PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this-week', label: 'This week' },
  { value: 'last-week', label: 'Last week' },
  { value: 'this-month', label: 'This month' },
  { value: 'last-month', label: 'Last month' },
  { value: 'this-year', label: 'This year' },
  { value: 'last-year', label: 'Last year' },
] as const;
const GROUPS = [{ value: 'day', label: 'Daily' }, { value: 'week', label: 'Weekly' }, { value: 'month', label: 'Monthly' }, { value: 'year', label: 'Yearly' }] as const;

const utc = (ymd: string) => new Date(`${ymd}T00:00:00Z`);
const fmt = {
  day: new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }),
  short: new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
  month: new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
};
function bucketLabel(start: string, group: Pnl['group'], from: string, to: string) {
  if (group === 'year') return start.slice(0, 4);
  if (group === 'month') return fmt.month.format(utc(start));
  if (group === 'week') {
    const a = start < from ? from : start;
    const end = addDays(start, 6);
    return `${fmt.short.format(utc(a))} – ${fmt.short.format(utc(end > to ? to : end))}`;
  }
  return fmt.day.format(utc(start));
}

// Accounts show paisa as two digits (৳48,639.50); whole amounts stay whole.
const taka2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (n: number) => {
  const a = Math.abs(n);
  const s = Number.isInteger(Math.round(a * 100) / 100) ? formatTaka(a) : `৳${taka2.format(a)}`;
  return n < 0 ? `−${s}` : s;
};

/**
 * Profit & loss in the Zoho Books layout. Sales count on the day an order is
 * delivered (cash on delivery: the money is in hand); product cost is what each
 * sold piece cost when it sold; expenses are entered here by date.
 */
export default async function AccountingPage({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string; group?: string }> }) {
  const [{ supabase }, sp] = await Promise.all([requirePermission('revenue'), searchParams]);
  const today = dhakaToday();
  const range = resolveRange(sp.range ?? 'this-month', sp.from, sp.to, new Date(), 3650);
  const days = Math.round((utc(range.to).getTime() - utc(range.from).getTime()) / 86_400_000) + 1;
  const wanted = GROUPS.find((g) => g.value === sp.group)?.value ?? autoGroup(days);
  // Daily rows only up to about a year.
  const group = wanted === 'day' && days > 400 ? 'month' : wanted;

  const [{ data, error }, { data: expenseRows }] = await Promise.all([
    supabase.rpc('accounting_pnl', { p_from: range.from, p_to: range.to, p_group: group }),
    supabase.from('expenses').select('id, spent_on, category, amount, paid_via, reference, note').gte('spent_on', range.from).lte('spent_on', range.to).order('spent_on', { ascending: false }).order('created_at', { ascending: false }).limit(500),
  ]);

  if (error || !data) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Accounting</h1>
        <p className="rounded-xl bg-bad/10 px-4 py-3 text-sm text-bad">Could not load the accounts. Run the latest database update (0033) in Supabase, then reload.</p>
      </div>
    );
  }

  const p = data as Pnl;
  const n = (v: unknown) => toNumber(v as number | string);
  const income = n(p.income);
  const cogs = n(p.cogs);
  const expensesTotal = n(p.expenses_total);
  const { gross, net, grossMargin, netMargin } = pnlTotals({ income, cogs, expenses_total: expensesTotal });
  const missing = n(p.units_missing_cost);
  const keepRange = `range=${range.preset}${range.preset === 'custom' ? `&from=${range.from}&to=${range.to}` : ''}`;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Accounting</h1>
          <p className="text-sm text-muted">Profit &amp; loss for {days === 1 ? 'one day' : `${days} days`} · sales count when an order is delivered · deleted orders never count.</p>
        </div>
        <div className="no-print flex flex-wrap items-center gap-2">
          <DateRangePicker basePath="/admin/accounting" preset={range.preset} from={range.from} to={range.to} today={today} presets={PRESETS} keep={sp.group ? `group=${group}` : ''} />
          <PrintButton />
        </div>
      </header>

      {missing > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-warn/10 px-4 py-3 text-[13.5px] text-warn">
          <Icon name="note" size={18} className="shrink-0" />
          <p className="min-w-0 flex-1"><b>{missing} sold piece{missing === 1 ? ' has' : 's have'} no cost price</b>, so the profit below is higher than the real one. Add the cost price in <Link href="/admin/products" className="underline">Products</Link> — past sales pick it up automatically.</p>
          <ReapplyCosts from={range.from} to={range.to} />
        </div>
      )}

      {/* Headline numbers. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon="cash" tone="bg-[#2563eb]" label="Income" value={money(income)} sub={`${n(p.orders)} order${n(p.orders) === 1 ? '' : 's'} delivered`} />
        <Kpi icon="box" tone="bg-[#7c3aed]" label="Gross profit" value={money(gross)} sub={grossMargin === null ? 'No sales' : `${grossMargin}% of income`} negative={gross < 0} />
        <Kpi icon="tag" tone="bg-[#ea580c]" label="Expenses" value={money(expensesTotal)} sub={`${Object.keys(p.expenses ?? {}).length} categor${Object.keys(p.expenses ?? {}).length === 1 ? 'y' : 'ies'}`} />
        <Kpi icon="chart" tone={net < 0 ? 'bg-bad' : 'bg-ok'} label={net < 0 ? 'Net loss' : 'Net profit'} value={money(net)} sub={netMargin === null ? '—' : `${netMargin}% of income`} negative={net < 0} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* The statement. */}
        <section className="card overflow-hidden">
          <h2 className="border-b border-line px-5 py-3.5 font-semibold">Profit &amp; loss statement</h2>
          <table className="w-full text-[14px]">
            <tbody>
              <Head>Operating income</Head>
              <Line label="Product sales">{money(n(p.product_sales))}</Line>
              {n(p.discounts) > 0 && <Line label="Less: discounts">{money(-n(p.discounts))}</Line>}
              <Line label="Delivery charges collected">{money(n(p.delivery_income))}</Line>
              <Total label="Total income">{money(income)}</Total>

              <Head>Cost of goods sold</Head>
              <Line label={`Product cost (${n(p.units)} piece${n(p.units) === 1 ? '' : 's'} sold)`}>{money(-cogs)}</Line>
              <Total label="Gross profit" strong negative={gross < 0}>{money(gross)}</Total>

              <Head>Operating expenses</Head>
              {CATEGORY_KEYS.filter((k) => n(p.expenses?.[k]) > 0).map((k) => <Line key={k} label={EXPENSE_CATEGORIES[k].label}>{money(-n(p.expenses[k]))}</Line>)}
              {expensesTotal === 0 && <Line label="No expenses entered">{money(0)}</Line>}
              <Total label="Total expenses">{money(-expensesTotal)}</Total>

              <tr className={net < 0 ? 'bg-bad/10' : 'bg-ok/10'}>
                <th scope="row" className="px-5 py-4 text-left text-[15px] font-bold">{net < 0 ? 'Net loss' : 'Net profit'}</th>
                <td className={`px-5 py-4 text-right text-[17px] font-bold ${net < 0 ? 'text-bad' : 'text-ok'}`}>{money(net)}</td>
              </tr>
            </tbody>
          </table>
          {n(p.returned_orders) > 0 && (
            <p className="border-t border-line px-5 py-3 text-[12.5px] text-muted">
              {n(p.returned_orders)} order{n(p.returned_orders) === 1 ? ' was' : 's were'} returned in this period ({money(n(p.returned_value))}) — not counted as income. Enter the courier’s return charge as a Courier expense.
            </p>
          )}
        </section>

        {/* Period by period. */}
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
            <h2 className="font-semibold">{GROUPS.find((g) => g.value === group)?.label} breakdown</h2>
            <nav className="no-print flex rounded-lg bg-soft p-0.5" aria-label="Group by">
              {GROUPS.map((g) => {
                const disabled = g.value === 'day' && days > 400;
                return disabled ? (
                  <span key={g.value} className="px-2.5 py-1 text-[12px] font-semibold text-ink/30" title="Daily rows show for up to about a year">{g.label}</span>
                ) : (
                  <Link key={g.value} href={`/admin/accounting?${keepRange}&group=${g.value}`} aria-current={group === g.value ? 'page' : undefined} className={`rounded-md px-2.5 py-1 text-[12px] font-semibold ${group === g.value ? 'bg-white text-night shadow-sm' : 'text-muted hover:text-night'}`}>{g.label}</Link>
                );
              })}
            </nav>
          </div>
          <div className="max-h-[34rem] overflow-auto">
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 bg-soft text-left text-[11.5px] uppercase tracking-wide text-muted">
                <tr><th className="px-4 py-2.5">Period</th><th className="px-3 py-2.5 text-right">Orders</th><th className="px-3 py-2.5 text-right">Income</th><th className="px-3 py-2.5 text-right">Cost</th><th className="px-3 py-2.5 text-right">Expenses</th><th className="px-4 py-2.5 text-right">Net</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {[...p.buckets].reverse().map((b) => {
                  const bNet = n(b.income) - n(b.cogs) - n(b.expenses);
                  const empty = !n(b.orders) && !n(b.expenses);
                  return (
                    <tr key={b.start} className={empty ? 'text-ink/40' : ''}>
                      <td className="whitespace-nowrap px-4 py-2">{bucketLabel(b.start, group, range.from, range.to)}</td>
                      <td className="px-3 py-2 text-right">{n(b.orders)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">{money(n(b.income))}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">{money(n(b.cogs))}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">{money(n(b.expenses))}</td>
                      <td className={`whitespace-nowrap px-4 py-2 text-right font-semibold ${empty ? '' : bNet < 0 ? 'text-bad' : 'text-ok'}`}>{money(Math.round(bNet * 100) / 100)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="sticky bottom-0 bg-white font-bold shadow-[0_-1px_0_var(--line)]">
                <tr>
                  <td className="px-4 py-2.5">Total</td>
                  <td className="px-3 py-2.5 text-right">{n(p.orders)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">{money(income)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">{money(cogs)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">{money(expensesTotal)}</td>
                  <td className={`whitespace-nowrap px-4 py-2.5 text-right ${net < 0 ? 'text-bad' : 'text-ok'}`}>{money(net)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold">Expenses</h2>
          <p className="text-[13px] text-muted">Ad cost, salaries, rent, courier charges and the rest — by the day you paid. The list shows this period.</p>
        </div>
        <ExpenseManager expenses={(expenseRows ?? []) as Expense[]} today={today} />
      </section>
    </div>
  );
}

function Kpi({ icon, tone, label, value, sub, negative = false }: { icon: IconName; tone: string; label: string; value: string; sub: string; negative?: boolean }) {
  return (
    <div className="card flex items-start gap-3 p-4">
      <span className={`hidden h-10 w-10 shrink-0 place-items-center rounded-xl text-white sm:grid ${tone}`}><Icon name={icon} size={19} /></span>
      <div className="min-w-0">
        <p className="text-[12.5px] text-muted">{label}</p>
        <p className={`break-all text-[1.15rem] font-bold leading-tight sm:text-[1.35rem] ${negative ? 'text-bad' : ''}`}>{value}</p>
        <p className="text-[12px] text-muted">{sub}</p>
      </div>
    </div>
  );
}
function Head({ children }: { children: ReactNode }) {
  return <tr><th colSpan={2} scope="colgroup" className="bg-soft px-5 pb-1.5 pt-3 text-left text-[11.5px] font-bold uppercase tracking-wide text-muted">{children}</th></tr>;
}
function Line({ label, children }: { label: string; children: ReactNode }) {
  return <tr className="border-b border-line/70"><td className="px-5 py-2 pl-8 text-ink/80">{label}</td><td className="whitespace-nowrap px-5 py-2 text-right">{children}</td></tr>;
}
function Total({ label, children, strong = false, negative = false }: { label: string; children: ReactNode; strong?: boolean; negative?: boolean }) {
  return (
    <tr className="border-b border-line">
      <th scope="row" className={`px-5 py-2.5 text-left ${strong ? 'text-[15px] font-bold' : 'font-semibold'}`}>{label}</th>
      <td className={`whitespace-nowrap px-5 py-2.5 text-right ${strong ? 'text-[15px] font-bold' : 'font-semibold'} ${negative ? 'text-bad' : ''}`}>{children}</td>
    </tr>
  );
}
