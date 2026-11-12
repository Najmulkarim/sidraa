import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { DateRangePicker } from '@/components/admin/DateRangePicker';
import { ExpenseManager, PrintButton, ReapplyCosts, type Expense } from '@/components/admin/ExpenseManager';
import { Icon, type IconName } from '@/components/icons';
import { autoGroup, CATEGORY_KEYS, EXPENSE_CATEGORIES, pnlTotals, type Pnl } from '@/lib/accounting';
import { requirePermission } from '@/lib/auth';
import { getSettings } from '@/lib/catalog';
import { AccountingOrders } from '@/components/admin/AccountingOrders';
import type { FeeRate } from '@/lib/courier-insight';
import { costRow, type CostOrder } from '@/lib/order-costs';
import type { createClient } from '@/lib/supabase/server';
import { AccountingTabs, usedCouriers } from '@/components/admin/AccountingTabs';
import { AccountingHero as Hero, periodLabel } from '@/components/admin/AccountingHero';
import { addDays, dhakaDayStartUtc, dhakaToday, formatMoney, formatTaka, resolveRange, toNumber } from '@/lib/format';

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

const money = formatMoney;

/**
 * Profit & loss in the Zoho Books layout. Sales count on the day an order is
 * delivered (cash on delivery: the money is in hand); product cost is what each
 * sold piece cost when it sold; expenses are entered here by date.
 */
export default async function AccountingPage({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string; group?: string; oq?: string }> }) {
  const [{ supabase }, sp] = await Promise.all([requirePermission('revenue'), searchParams]);
  const today = dhakaToday();
  const range = resolveRange(sp.range ?? 'today', sp.from, sp.to, new Date(), 3650);
  const days = Math.round((utc(range.to).getTime() - utc(range.from).getTime()) / 86_400_000) + 1;
  const wanted = GROUPS.find((g) => g.value === sp.group)?.value ?? autoGroup(days);
  // Daily rows only up to about a year.
  const group = wanted === 'day' && days > 400 ? 'month' : wanted;

  // An order-number search in "Order by order" looks through every date.
  const orderSearch = (sp.oq ?? '').trim().replace(/[^a-z0-9-]/gi, '').slice(0, 30);
  const [{ data, error }, { data: expenseRows }, { data: unpaidReturns }, couriers, settings, costOrders, { data: rateRows }] = await Promise.all([
    supabase.rpc('accounting_pnl', { p_from: range.from, p_to: range.to, p_group: group }),
    supabase.from('expenses').select('id, spent_on, category, amount, paid_via, reference, note').gte('spent_on', range.from).lte('spent_on', range.to).order('spent_on', { ascending: false }).order('created_at', { ascending: false }).limit(500),
    // Paid returns whose amount nobody has entered yet (the courier did not send it).
    supabase.from('orders').select('id, public_ref').eq('status', 'returned').is('deleted_at', null).eq('paid_amount', 0)
      .ilike('courier_status', '%paid%return%').order('returned_at', { ascending: false }).limit(20),
    usedCouriers(supabase),
    getSettings(),
    loadCostOrders(supabase, range.from, range.to, orderSearch),
    supabase.from('courier_fee_rates').select('courier, cod_rate, effective_from').limit(200),
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
  const rates: Record<string, FeeRate[]> = {};
  for (const r of (rateRows ?? []) as (FeeRate & { courier: string })[]) (rates[r.courier] ??= []).push(r);
  const costRows = costOrders.map((o) => costRow(o, rates)).sort((a, b) => b.counted_at.localeCompare(a.counted_at));
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
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Accounting</h1>
            <AccountingTabs active="pnl" couriers={couriers} />
          </div>
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

      {(unpaidReturns ?? []).length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-warn/10 px-4 py-3 text-[13.5px] text-warn">
          <Icon name="cash" size={18} className="shrink-0" />
          <p className="min-w-0 flex-1">
            <b>{unpaidReturns!.length} paid return{unpaidReturns!.length === 1 ? '' : 's'} without the amount the customer paid.</b> Open the order and enter it in Paid, so it counts as income:{' '}
            {unpaidReturns!.map((o, i) => <span key={o.id}>{i > 0 && ', '}<Link href={`/admin/orders/${o.id}`} className="font-semibold underline">{o.public_ref}</Link></span>)}
          </p>
        </div>
      )}

      {/* Headline: where the period's money went. */}
      <Hero
        period={periodLabel(range.from, range.to)} net={net} netMargin={netMargin} income={income} gross={gross} grossMargin={grossMargin}
        cogs={cogs} expenses={expensesTotal}
        incomeSub={`${n(p.orders)} delivered${n(p.paid_returns) > 0 ? ` · ${n(p.paid_returns)} paid return${n(p.paid_returns) === 1 ? '' : 's'}` : ''}`}
        cogsSub={`${n(p.units)} piece${n(p.units) === 1 ? '' : 's'} sold`}
        brand={settings.store_name} from={range.from} to={range.to}
        expenseSub={`${n(p.returned_orders) > 0 ? `${n(p.returned_orders)} return${n(p.returned_orders) === 1 ? '' : 's'} · ` : ''}courier, ads & more`}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* The statement. */}
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-tint text-brand"><Icon name="note" size={17} /></span>
              <div>
                <h2 className="font-semibold leading-tight">Profit &amp; loss statement</h2>
                <p className="text-[12px] text-muted">{periodLabel(range.from, range.to)}</p>
              </div>
            </div>
          </div>
          <table className="w-full text-[14px]">
            <tbody>
              <Head icon="cash">Operating income</Head>
              <Line label="Product sales">{money(n(p.product_sales))}</Line>
              {n(p.discounts) > 0 && <Line label="Less: discounts">{money(-n(p.discounts))}</Line>}
              <Line label="Delivery charges collected">{money(n(p.delivery_income))}</Line>
              {n(p.short_at_door) > 0 && <Line label={`Less: customers paid less at the door (${n(p.short_orders)} order${n(p.short_orders) === 1 ? '' : 's'})`}>{money(-n(p.short_at_door))}</Line>}
              {n(p.return_income) > 0 && <Line label={`Paid by customers on returns (${n(p.paid_returns)} paid return${n(p.paid_returns) === 1 ? '' : 's'})`}>{money(n(p.return_income))}</Line>}
              <Total label="Total income">{money(income)}</Total>

              <Head icon="box">Cost of goods sold</Head>
              <Line label={`Product cost (${n(p.units)} piece${n(p.units) === 1 ? '' : 's'} sold)`}>{money(-cogs)}</Line>
              <Total label="Gross profit" strong negative={gross < 0}>{money(gross)}</Total>

              <Head icon="tag">Operating expenses</Head>
              {CATEGORY_KEYS.filter((k) => n(p.expenses?.[k]) > 0).map((k) => <Line key={k} label={EXPENSE_CATEGORIES[k].label}>{money(-n(p.expenses[k]))}</Line>)}
              {n(p.courier_delivery) > 0 && <Line label={`Courier delivery charges (${n(p.courier_orders)} delivered order${n(p.courier_orders) === 1 ? '' : 's'})`}>{money(-n(p.courier_delivery))}</Line>}
              {n(p.return_delivery) > 0 && <Line label={`Delivery cost on returned orders (${n(p.returned_orders)})`}>{money(-n(p.return_delivery))}</Line>}
              {n(p.cod_fees) > 0 && <Line label="Courier COD fees (on the cash collected)">{money(-n(p.cod_fees))}</Line>}
              {n(p.courier_missing) > 0 && <Line label={`${n(p.courier_missing)} delivered order${n(p.courier_missing) === 1 ? ' has' : 's have'} no courier charge yet`}><span className="text-warn">not counted</span></Line>}
              {expensesTotal === 0 && <Line label="No expenses entered">{money(0)}</Line>}
              <Total label="Total expenses">{money(-expensesTotal)}</Total>

              <tr className={net < 0 ? 'bg-gradient-to-r from-bad/12 to-bad/5' : 'bg-gradient-to-r from-ok/14 to-ok/5'}>
                <th scope="row" className="px-5 py-5 text-left">
                  <span className="block text-[15px] font-bold">{net < 0 ? 'Net loss' : 'Net profit'}</span>
                  {netMargin !== null && <span className="text-[12px] font-medium text-muted">{netMargin}% of income</span>}
                </th>
                <td className={`px-5 py-5 text-right text-[1.6rem] font-bold tracking-tight ${net < 0 ? 'text-bad' : 'text-ok'}`}>{money(net)}</td>
              </tr>
            </tbody>
          </table>
          {n(p.returned_orders) > 0 && (
            <p className="border-t border-line px-5 py-3 text-[12.5px] text-muted">
              {n(p.returned_orders)} order{n(p.returned_orders) === 1 ? ' was' : 's were'} returned in this period ({money(n(p.returned_value))}) — the products are not counted as income{n(p.return_income) > 0 && <>, only the {money(n(p.return_income))} the customers paid at the door (a paid return)</>}. Their delivery cost is already in the expenses above, so do not enter it again.
            </p>
          )}
        </section>

        {/* Period by period. */}
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-tint text-brand"><Icon name="chart" size={17} /></span>
              <h2 className="font-semibold">{GROUPS.find((g) => g.value === group)?.label} breakdown</h2>
            </div>
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
                <tr><th className="px-4 py-2.5">Period</th><th className="px-3 py-2.5 text-right">Delivered</th><th className="px-3 py-2.5 text-right">Income</th><th className="px-3 py-2.5 text-right">Cost</th><th className="px-3 py-2.5 text-right">Expenses</th><th className="px-4 py-2.5 text-right">Net</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {[...p.buckets].reverse().map((b, _i, all) => {
                  const most = Math.max(1, ...all.map((x) => Math.abs(n(x.income) - n(x.cogs) - n(x.expenses))));
                  const bNet = n(b.income) - n(b.cogs) - n(b.expenses);
                  const empty = !n(b.orders) && !n(b.expenses) && !n(b.returns);
                  return (
                    <tr key={b.start} className={`transition hover:bg-soft/60 ${empty ? 'text-ink/40' : ''}`}>
                      <td className="whitespace-nowrap px-4 py-2">{bucketLabel(b.start, group, range.from, range.to)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">{n(b.orders)}{n(b.returns) > 0 && <span className="text-[12px] font-normal text-muted"> · {n(b.returns)} return{n(b.returns) === 1 ? '' : 's'}</span>}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">{money(n(b.income))}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">{money(n(b.cogs))}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">{money(n(b.expenses))}</td>
                      <td className={`whitespace-nowrap px-4 py-2 text-right font-semibold ${empty ? '' : bNet < 0 ? 'text-bad' : 'text-ok'}`}>
                        {money(Math.round(bNet * 100) / 100)}
                        {!empty && (
                          <span className="mt-1 ml-auto block h-1 w-16 overflow-hidden rounded-full bg-soft" aria-hidden>
                            <span className={`block h-full rounded-full ${bNet < 0 ? 'bg-bad/70' : 'bg-ok/70'}`} style={{ width: `${Math.max(4, Math.round((Math.abs(bNet) / most) * 100))}%` }} />
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="sticky bottom-0 bg-white font-bold shadow-[0_-1px_0_var(--line)]">
                <tr>
                  <td className="px-4 py-2.5">Total</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">{n(p.orders)}{n(p.returned_orders) > 0 && <span className="text-[12px] font-normal text-muted"> · {n(p.returned_orders)} return{n(p.returned_orders) === 1 ? '' : 's'}</span>}</td>
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

      {/* Every order behind the statement, to find and correct a wrong figure. */}
      <AccountingOrders rows={costRows} search={orderSearch}
        keep={Object.fromEntries(Object.entries({ range: range.preset, from: range.preset === 'custom' ? range.from : '', to: range.preset === 'custom' ? range.to : '', group: sp.group ?? '' }).filter(([, v]) => v))} />

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-tint text-brand"><Icon name="tag" size={17} /></span>
            <div>
              <h2 className="text-lg font-bold leading-tight">Expenses</h2>
              <p className="text-[12.5px] text-muted">Ads, salaries, rent and the rest — by the day you paid. Parcel charges and COD fees are added automatically.</p>
            </div>
          </div>
        </div>
        <ExpenseManager expenses={(expenseRows ?? []) as Expense[]} today={today} />
      </section>
    </div>
  );
}

function Head({ children, icon }: { children: ReactNode; icon?: IconName }) {
  return (
    <tr>
      <th colSpan={2} scope="colgroup" className="bg-soft/70 px-5 pb-2 pt-3.5 text-left text-[11.5px] font-bold uppercase tracking-[0.08em] text-muted">
        <span className="inline-flex items-center gap-1.5">{icon && <Icon name={icon} size={13} />}{children}</span>
      </th>
    </tr>
  );
}
function Line({ label, children }: { label: string; children: ReactNode }) {
  return <tr className="border-b border-line/60 transition hover:bg-soft/50"><td className="px-5 py-2.5 pl-8 text-ink/80">{label}</td><td className="whitespace-nowrap px-5 py-2 text-right">{children}</td></tr>;
}
function Total({ label, children, strong = false, negative = false }: { label: string; children: ReactNode; strong?: boolean; negative?: boolean }) {
  return (
    <tr className="border-b border-line">
      <th scope="row" className={`px-5 py-2.5 text-left ${strong ? 'text-[15px] font-bold' : 'font-semibold'}`}>{label}</th>
      <td className={`whitespace-nowrap px-5 py-2.5 text-right ${strong ? 'text-[15px] font-bold' : 'font-semibold'} ${negative ? 'text-bad' : ''}`}>{children}</td>
    </tr>
  );
}

const COST_SELECT = 'id, public_ref, status, delivered_at, returned_at, total, paid_amount, paid_before_delivery, delivery_charge, courier, courier_consignment_id, courier_charge, courier_cod_fee, courier_sent_at, items:order_items(id, product_name, variant_label, quantity, unit_cost)';

/** The orders the statement counts in the period: delivered in it, or returned in it (read 1,000 at a time). */
async function loadCostOrders(supabase: Awaited<ReturnType<typeof createClient>>, from: string, to: string, search = ''): Promise<CostOrder[]> {
  const start = dhakaDayStartUtc(from), end = dhakaDayStartUtc(addDays(to, 1));
  const out: CostOrder[] = [];
  for (const [status, col] of [['delivered', 'delivered_at'], ['returned', 'returned_at']] as const) {
    for (let at = 0; at < 20_000; at += 1000) {
      const base = supabase.from('orders').select(COST_SELECT).eq('status', status).is('deleted_at', null);
      const { data, error } = await (search ? base.ilike('public_ref', `%${search}%`) : base.gte(col, start).lt(col, end))
        .order(col, { ascending: false }).order('id').range(at, at + 999);
      if (error) { console.error('[admin] accounting orders', error); break; }
      const rows = (data ?? []) as unknown as (Omit<CostOrder, 'counted_at'> & { delivered_at: string | null; returned_at: string | null })[];
      for (const r of rows) out.push({ ...r, counted_at: (status === 'delivered' ? r.delivered_at : r.returned_at) ?? '' });
      if (rows.length < 1000) break;
    }
  }
  return out;
}
