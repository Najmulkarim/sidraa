import { Icon } from '@/components/icons';
import { formatMoney as money } from '@/lib/format';

const utc = (ymd: string) => new Date(`${ymd}T00:00:00Z`);
const fmt = {
  day: new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }),
  short: new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
};
const longDay = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
export function periodLabel(from: string, to: string) {
  if (from === to) return fmt.day.format(utc(from)) + ' ' + from.slice(0, 4);
  return `${from.slice(0, 4) === to.slice(0, 4) ? fmt.short.format(utc(from)) : longDay.format(utc(from))} – ${longDay.format(utc(to))}`;
}

/** The period at a glance, in statement order (income − product cost = gross profit − expenses = net profit), and where each taka of income went. */
export function AccountingHero({ period, net, netMargin, income, gross, grossMargin, cogs, expenses, incomeSub, expenseSub, cogsSub = '' }: {
  period: string; net: number; netMargin: number | null; income: number; gross: number; grossMargin: number | null;
  cogs: number; expenses: number; incomeSub: string; expenseSub: string; cogsSub?: string;
}) {
  const loss = net < 0;
  // Shares of income: product cost, expenses, and what is left (profit). A loss shows the costs against income.
  const base = Math.max(income, cogs + expenses, 1);
  const parts = [
    { key: 'cogs', label: 'Product cost', value: cogs, color: '#7c83f0' },
    { key: 'exp', label: 'Expenses', value: expenses, color: '#c97c00' },
    { key: 'net', label: 'Profit', value: Math.max(net, 0), color: '#0ea371' },
  ].filter((x) => x.value > 0);
  return (
    <section className="relative overflow-hidden rounded-2xl bg-night p-5 text-white shadow-lg sm:p-6">
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand/30 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 left-1/4 h-72 w-72 rounded-full bg-[#34d399]/10 blur-3xl" />
      <div className="relative space-y-5">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] font-semibold uppercase tracking-[0.14em] text-white/55">
          <span className="inline-flex items-center gap-2"><Icon name="calendar" size={14} /> {period}</span>
          <span className="hidden font-medium normal-case tracking-normal text-white/40 sm:inline">Income − product cost = gross profit − expenses = net profit</span>
        </p>

        {/* The statement in one line, left to right; net profit last and largest. */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1.3fr)] lg:items-stretch lg:gap-2">
          <HeroStat label="Income" value={money(income)} sub={incomeSub} />
          <Op>−</Op>
          <HeroStat label="Product cost" value={money(cogs)} sub={cogsSub || (income > 0 ? `${Math.round((cogs / income) * 100)}% of income` : '—')} />
          <Op>=</Op>
          <HeroStat label="Gross profit" value={money(gross)} sub={grossMargin === null ? 'No sales' : `${grossMargin}% margin`} />
          <Op>−</Op>
          <HeroStat label="Expenses" value={money(expenses)} sub={expenseSub} />
          <Op>=</Op>
          <div className={`col-span-2 order-first min-w-0 rounded-xl p-3.5 ring-1 lg:order-none lg:col-span-1 ${loss ? 'bg-[#fda4af]/12 ring-[#fda4af]/30' : 'bg-[#34d399]/12 ring-[#34d399]/30'}`}>
            <p className={`text-[11.5px] font-semibold ${loss ? 'text-[#fda4af]' : 'text-[#6ee7b7]'}`}>{loss ? 'Net loss' : 'Net profit'}</p>
            <p className={`mt-0.5 truncate text-[1.7rem] font-bold leading-tight tracking-tight sm:text-[1.9rem] ${loss ? 'text-[#fda4af]' : ''}`}>{money(net)}</p>
            <p className="truncate text-[11px] text-white/55">{netMargin === null ? '—' : `${netMargin}% of income`}</p>
          </div>
        </div>

        {income > 0 || cogs + expenses > 0 ? (
          <div>
            <p className="mb-2 text-[12px] font-medium text-white/55">Where the income went</p>
            <div className="flex h-3 gap-[2px] overflow-hidden rounded-full bg-white/10" role="img"
              aria-label={parts.map((x) => `${x.label} ${money(x.value)}`).join(', ')}>
              {parts.map((x) => (
                <span key={x.key} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(x.value / base) * 100}%`, background: x.color }} title={`${x.label}: ${money(x.value)}`} />
              ))}
            </div>
            <ul className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-white/75">
              {parts.map((x) => (
                <li key={x.key} className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: x.color }} aria-hidden />
                  {x.label} <b className="font-semibold text-white">{money(x.value)}</b>
                  {income > 0 && <span className="text-white/45">{Math.round((x.value / income) * 100)}%</span>}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-[13px] text-white/55">No sales or expenses in this period yet.</p>
        )}
      </div>
    </section>
  );
}
/** The − and = between the figures (wide screens only). */
function Op({ children }: { children: string }) {
  return <span aria-hidden className="hidden place-items-center text-[1.3rem] font-light text-white/35 lg:grid">{children}</span>;
}
function HeroStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.06] p-3.5 backdrop-blur-sm">
      <p className="text-[11.5px] font-medium text-white/60">{label}</p>
      <p className="mt-0.5 truncate text-[1.05rem] font-bold sm:text-[1.25rem]">{value}</p>
      <p className="truncate text-[11px] text-white/45">{sub}</p>
    </div>
  );
}
