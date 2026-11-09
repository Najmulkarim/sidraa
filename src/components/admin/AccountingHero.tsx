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
export function AccountingHero({ period, net, netMargin, income, gross, grossMargin, cogs, expenses, incomeSub, expenseSub, cogsSub = '', brand, from, to }: {
  period: string; net: number; netMargin: number | null; income: number; gross: number; grossMargin: number | null;
  cogs: number; expenses: number; incomeSub: string; expenseSub: string; cogsSub?: string;
  /** The shop's name, written where a bank card says VISA. */
  brand: string;
  /** The period as YYYY-MM-DD, for the card's "valid" dates. */
  from: string; to: string;
}) {
  const loss = net < 0;
  // Shares of income: product cost, expenses, and what is left (profit). A loss shows the costs against income.
  const base = Math.max(income, cogs + expenses, 1);
  const parts = [
    { key: 'cogs', label: 'Product cost', value: cogs, color: COLOR.cogs },
    { key: 'exp', label: 'Expenses', value: expenses, color: COLOR.exp },
    { key: 'net', label: 'Profit', value: Math.max(net, 0), color: COLOR.net },
  ].filter((x) => x.value > 0);

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

        {/* Right: the result, as a bank card. */}
        <div className="order-first flex items-center justify-center lg:order-none">
          <ProfitCard net={net} netMargin={netMargin} brand={brand} from={from} to={to} />
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

const ddmm = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;

/**
 * Net profit as a bank card (the real card shape, 85.6 × 54 mm): a gold chip,
 * the amount where the card number goes, the period as its "valid" dates, and
 * the shop's name where the card network's name sits.
 */
function ProfitCard({ net, netMargin, brand, from, to }: { net: number; netMargin: number | null; brand: string; from: string; to: string }) {
  const loss = net < 0;
  return (
    <div
      className={`relative aspect-[85.6/54] w-full max-w-[24rem] select-none overflow-hidden rounded-[18px] p-[6%] text-white shadow-[0_18px_40px_-12px_rgba(0,0,0,0.7)] ring-1 ring-white/15 ${loss
        ? 'bg-[linear-gradient(135deg,#5b0f22_0%,#2a0912_55%,#140509_100%)]'
        : 'bg-[linear-gradient(135deg,#0b3d33_0%,#08241f_50%,#05110f_100%)]'}`}
      role="img"
      aria-label={`${loss ? 'Net loss' : 'Net profit'} ${money(net)}${netMargin !== null ? `, ${netMargin}% of income` : ''}, ${ddmm(from)} to ${ddmm(to)}`}
    >
      {/* Card art: soft waves, a sheen and a glow. */}
      <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.16]" viewBox="0 0 400 252" preserveAspectRatio="none">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <path key={i} d={`M-20 ${150 + i * 18} C 90 ${90 + i * 18}, 220 ${230 + i * 14}, 420 ${120 + i * 16}`} fill="none" stroke={loss ? '#fda4af' : '#6ee7b7'} strokeWidth="1" />
        ))}
      </svg>
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_35%,rgba(255,255,255,0.08)_45%,transparent_55%)]" />

      <div className="relative flex h-full flex-col">
        {/* Top: what the card shows, and a contactless mark. */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/80">{loss ? 'Net loss' : 'Net profit'}</p>
            {netMargin !== null && <p className={`text-[10px] font-semibold ${loss ? 'text-[#fda4af]' : 'text-[#6ee7b7]'}`}>{netMargin}% of income</p>}
          </div>
          <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6 text-white/75" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M7 9.5a3.5 3.5 0 0 1 0 5" /><path d="M10.5 7a7 7 0 0 1 0 10" /><path d="M14 4.5a10.5 10.5 0 0 1 0 15" />
          </svg>
        </div>

        {/* The gold chip. */}
        <Chip />

        {/* The amount, where the card number goes. */}
        <p className="mt-auto pt-1.5 font-mono text-[clamp(1.2rem,5vw,1.9rem)] font-semibold leading-none tracking-[0.06em] text-white/95 [text-shadow:0_1px_0_rgba(255,255,255,0.25),0_-1px_0_rgba(0,0,0,0.6)] lg:text-[1.75rem]">
          {money(net)}
        </p>

        {/* Bottom: the period as "valid" dates, and the shop's name where VISA goes. */}
        <div className="mt-[5%] flex items-end justify-between gap-3">
          <div className="flex gap-4 font-mono text-white/85">
            <div>
              <p className="text-[7.5px] font-sans font-semibold uppercase leading-tight tracking-wider text-white/50">Valid<br />from</p>
              <p className="text-[12px] tracking-wider">{ddmm(from)}</p>
            </div>
            <div>
              <p className="text-[7.5px] font-sans font-semibold uppercase leading-tight tracking-wider text-white/50">Valid<br />thru</p>
              <p className="text-[12px] tracking-wider">{ddmm(to)}</p>
            </div>
          </div>
          <p className="max-w-[55%] truncate text-right text-[1.45rem] font-black italic leading-none tracking-tight text-white [text-shadow:0_2px_6px_rgba(0,0,0,0.35)]">
            {brand}
          </p>
        </div>
      </div>
    </div>
  );
}

/** A gold EMV chip. */
function Chip() {
  return (
    <svg aria-hidden viewBox="0 0 50 38" className="mt-[3%] h-[19%] w-auto self-start drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]">
      <defs>
        <linearGradient id="chip-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f8e7a1" />
          <stop offset="35%" stopColor="#d9b25a" />
          <stop offset="65%" stopColor="#f3d886" />
          <stop offset="100%" stopColor="#b8892f" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="48" height="36" rx="6" fill="url(#chip-gold)" stroke="#8a6420" strokeWidth="0.8" />
      <g fill="none" stroke="#8a6420" strokeWidth="0.9" opacity="0.85">
        <path d="M1 13h14M1 25h14M35 13h14M35 25h14" />
        <path d="M15 1v10a4 4 0 0 0 4 4h12a4 4 0 0 0 4-4V1M15 37V27a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v10" />
        <rect x="19" y="15" width="12" height="8" rx="2" />
      </g>
    </svg>
  );
}
