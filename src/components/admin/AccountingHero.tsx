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
export function AccountingHero({ period, net, netMargin, income, gross, grossMargin, cogs, expenses, incomeSub, expenseSub, cogsSub = '', trend = [], trendLabel = 'Daily net' }: {
  period: string; net: number; netMargin: number | null; income: number; gross: number; grossMargin: number | null;
  cogs: number; expenses: number; incomeSub: string; expenseSub: string; cogsSub?: string;
  /** Net profit per period (oldest first), for the small line on the card. */
  trend?: number[]; trendLabel?: string;
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
        <div className={`group relative order-first overflow-hidden rounded-2xl p-[1px] lg:order-none ${loss
          ? 'bg-gradient-to-br from-[#fda4af]/50 via-[#fda4af]/10 to-transparent'
          : 'bg-gradient-to-br from-[#6ee7b7]/60 via-[#34d399]/10 to-transparent'}`}>
          <div className={`relative flex h-full flex-col gap-4 overflow-hidden rounded-[15px] p-5 ${loss
            ? 'bg-[radial-gradient(120%_90%_at_100%_0%,#7f1d3a_0%,#3b0a1a_45%,#1c0f14_100%)]'
            : 'bg-[radial-gradient(120%_90%_at_100%_0%,#0f766e_0%,#064e3b_40%,#0b1f1b_100%)]'}`}>
            {/* Soft dot pattern and a glow, for depth. */}
            <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(#fff_1px,transparent_1px)] [background-size:14px_14px]" />
            <div aria-hidden className={`pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full blur-3xl ${loss ? 'bg-[#fb7185]/20' : 'bg-[#34d399]/20'}`} />

            <div className="relative flex items-start justify-between gap-3">
              <div>
                <p className={`inline-flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-[0.16em] ${loss ? 'text-[#fda4af]' : 'text-[#6ee7b7]'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${loss ? 'bg-[#fda4af]' : 'bg-[#6ee7b7]'} shadow-[0_0_8px_currentColor]`} />
                  {loss ? 'Net loss' : 'Net profit'}
                </p>
                <p className="mt-0.5 text-[11.5px] text-white/45">{period}</p>
              </div>
              {netMargin !== null && <MarginRing pct={netMargin} loss={loss} />}
            </div>

            <Amount value={net} />

            <div className="relative mt-auto space-y-3">
              {trend.length > 1 && <Sparkline values={trend} loss={loss} label={trendLabel} />}
              {per100 !== null && (
                <p className="flex items-center gap-2 rounded-lg bg-black/20 px-3 py-2 text-[12px] text-white/70 ring-1 ring-white/5">
                  <Icon name="cash" size={14} className={loss ? 'text-[#fda4af]' : 'text-[#6ee7b7]'} />
                  {loss ? <>Every ৳100 sold lost <b className="text-white">৳{Math.abs(per100)}</b></> : <>Every ৳100 sold left <b className="text-white">৳{per100}</b> profit</>}
                </p>
              )}
            </div>
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

/** The amount with a small taka sign and small paisa, the whole taka large. */
function Amount({ value }: { value: number }) {
  const text = money(value); // e.g. "৳4,266.50" or "−৳1,200"
  const m = /^(−?)৳([\d,]+)(\.\d+)?$/.exec(text);
  if (!m) return <p className="relative truncate text-[2.5rem] font-bold leading-none tracking-tight">{text}</p>;
  return (
    <p className="relative flex items-baseline truncate font-bold leading-none tracking-tight">
      <span className="mr-1 text-[1.5rem] text-white/60">{m[1]}৳</span>
      <span className="text-[2.6rem] sm:text-[2.9rem]">{m[2]}</span>
      {m[3] && <span className="text-[1.4rem] text-white/50">{m[3]}</span>}
    </p>
  );
}

/** A small ring showing net profit as a share of income. */
function MarginRing({ pct, loss }: { pct: number; loss: boolean }) {
  const r = 20, c = 2 * Math.PI * r;
  const share = Math.min(100, Math.abs(pct));
  return (
    <div className="relative grid h-14 w-14 shrink-0 place-items-center" title={`${pct}% of income`}>
      <svg viewBox="0 0 48 48" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="4" />
        <circle cx="24" cy="24" r={r} fill="none" stroke={loss ? '#fda4af' : '#6ee7b7'} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={`${(share / 100) * c} ${c}`} />
      </svg>
      <span className="text-[11.5px] font-bold">{Math.round(pct)}%</span>
    </div>
  );
}

/** Net profit per period as a thin line, with a zero line when it crosses below zero. */
function Sparkline({ values, loss, label }: { values: number[]; loss: boolean; label: string }) {
  const w = 240, h = 44, pad = 3;
  const lo = Math.min(0, ...values), hi = Math.max(0, ...values);
  const span = hi - lo || 1;
  const x = (i: number) => pad + (i / (values.length - 1)) * (w - pad * 2);
  const y = (v: number) => pad + (1 - (v - lo) / span) * (h - pad * 2);
  const line = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(values.length - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;
  const stroke = loss ? '#fda4af' : '#6ee7b7';
  const id = loss ? 'spark-loss' : 'spark-profit';
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium text-white/45">{label}</p>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-11 w-full" preserveAspectRatio="none" role="img" aria-label={`${label}: ${values.map((v) => money(v)).join(', ')}`}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        {lo < 0 && hi > 0 && <line x1={pad} x2={w - pad} y1={y(0)} y2={y(0)} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
        <path d={area} fill={`url(#${id})`} />
        <path d={line} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
