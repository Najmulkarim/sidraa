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

// The same colours mark a figure's box and its part of the bar (checked for colour-blind safety on this dark panel).
const COLOR = { cogs: '#7c83f0', exp: '#c97c00', net: '#0ea371' };

/**
 * The period at a glance. Left: income, product cost, gross profit and
 * expenses, and where each taka of income went. Right: the net profit, on its
 * own card.
 */
export function AccountingHero({ period, net, netMargin, income, gross, grossMargin, cogs, expenses, incomeSub, expenseSub, cogsSub = '' }: {
  period: string; net: number; netMargin: number | null; income: number; gross: number; grossMargin: number | null;
  cogs: number; expenses: number; incomeSub: string; expenseSub: string; cogsSub?: string;
}) {
  const loss = net < 0;
  // Shares of income: product cost, expenses, and what is left (profit). A loss shows the costs against income.
  const base = Math.max(income, cogs + expenses, 1);
  const parts = [
    { key: 'cogs', label: 'Product cost', value: cogs, color: COLOR.cogs },
    { key: 'exp', label: 'Expenses', value: expenses, color: COLOR.exp },
    { key: 'net', label: 'Profit', value: Math.max(net, 0), color: COLOR.net },
  ].filter((x) => x.value > 0);
  const per100 = income > 0 ? Math.round((net / income) * 100) : null;

  return (
    <section className="relative overflow-hidden rounded-2xl bg-night p-4 text-white shadow-lg sm:p-5">
      <div aria-hidden className="pointer-events-none absolute -left-24 -top-28 h-72 w-72 rounded-full bg-brand/20 blur-3xl" />
      <div className="relative grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,22rem)] lg:gap-5">
        {/* Left: the figures behind the result. */}
        <div className="flex min-w-0 flex-col justify-between gap-5 p-1 sm:p-2">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-white/55">
              <Icon name="calendar" size={14} /> {period}
            </p>
            <p className="hidden text-[12px] text-white/40 xl:block">Income − product cost − expenses = net profit</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            <HeroStat label="Income" value={money(income)} sub={incomeSub} accent="#ffffff" />
            <HeroStat label="Product cost" value={money(cogs)} sub={cogsSub || (income > 0 ? `${Math.round((cogs / income) * 100)}% of income` : '—')} accent={COLOR.cogs} />
            <HeroStat label="Gross profit" value={money(gross)} sub={grossMargin === null ? 'No sales' : `${grossMargin}% margin`} accent="#94a3b8" />
            <HeroStat label="Expenses" value={money(expenses)} sub={expenseSub} accent={COLOR.exp} />
          </div>
          {income > 0 || cogs + expenses > 0 ? (
            <div>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <p className="text-[12px] font-medium text-white/60">Where the income went</p>
                {income > 0 && <p className="text-[12px] text-white/45">of {money(income)}</p>}
              </div>
              <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-full bg-white/10" role="img"
                aria-label={parts.map((x) => `${x.label} ${money(x.value)}`).join(', ')}>
                {parts.map((x) => (
                  <span key={x.key} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(x.value / base) * 100}%`, background: x.color }} title={`${x.label}: ${money(x.value)}`} />
                ))}
              </div>
              <ul className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-white/70">
                {parts.map((x) => (
                  <li key={x.key} className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: x.color }} aria-hidden />
                    {x.label} <b className="font-semibold text-white">{money(x.value)}</b>
                    {income > 0 && <span className="text-white/40">{Math.round((x.value / income) * 100)}%</span>}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-[13px] text-white/55">No sales or expenses in this period yet.</p>
          )}
        </div>

        {/* Right: the result, on its own card. */}
        <div className={`relative order-first flex flex-col justify-between overflow-hidden rounded-xl p-5 ring-1 lg:order-none ${loss
          ? 'bg-gradient-to-br from-[#4c0519] via-[#3b0a1a] to-[#1f1015] ring-[#fda4af]/25'
          : 'bg-gradient-to-br from-[#064e3b] via-[#053d30] to-[#0b2420] ring-[#34d399]/25'}`}>
          <div aria-hidden className={`pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full blur-2xl ${loss ? 'bg-[#fb7185]/25' : 'bg-[#34d399]/25'}`} />
          <div className="relative flex items-center justify-between gap-2">
            <p className={`text-[12px] font-semibold uppercase tracking-[0.14em] ${loss ? 'text-[#fda4af]' : 'text-[#6ee7b7]'}`}>{loss ? 'Net loss' : 'Net profit'}</p>
            <span className={`grid h-8 w-8 place-items-center rounded-lg ${loss ? 'bg-[#fda4af]/15 text-[#fda4af]' : 'bg-[#34d399]/15 text-[#6ee7b7]'}`}><Icon name="chart" size={16} /></span>
          </div>
          <p className="relative mt-3 truncate text-[2.4rem] font-bold leading-none tracking-tight sm:text-[2.7rem]">{money(net)}</p>
          <div className="relative mt-4 space-y-1.5">
            {netMargin !== null && (
              <p className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ${loss ? 'bg-[#fda4af]/15 text-[#fda4af]' : 'bg-[#34d399]/15 text-[#6ee7b7]'}`}>
                {netMargin}% of income
              </p>
            )}
            {per100 !== null && (
              <p className="text-[12px] text-white/55">
                {loss ? `Every ৳100 sold lost ৳${Math.abs(per100)}` : `Every ৳100 sold left ৳${per100} profit`}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroStat({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  return (
    <div className="relative min-w-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-3 transition hover:bg-white/[0.08]">
      <span aria-hidden className="absolute inset-y-3 left-0 w-[3px] rounded-r-full" style={{ background: accent, opacity: 0.85 }} />
      <p className="text-[11.5px] font-medium text-white/60">{label}</p>
      <p className="mt-1 truncate text-[1.1rem] font-bold leading-tight sm:text-[1.2rem]">{value}</p>
      <p className="mt-0.5 truncate text-[11px] text-white/45">{sub}</p>
    </div>
  );
}
