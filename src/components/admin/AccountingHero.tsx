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
export function AccountingHero({ period, net, netMargin, income, gross, grossMargin, cogs, expenses, incomeSub, expenseSub, cogsSub = '', brand, logo = null, from, to }: {
  period: string; net: number; netMargin: number | null; income: number; gross: number; grossMargin: number | null;
  cogs: number; expenses: number; incomeSub: string; expenseSub: string; cogsSub?: string;
  /** The shop's name and logo, on the card. */
  brand: string; logo?: string | null;
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
          <ProfitCard net={net} netMargin={netMargin} brand={brand} logo={logo} from={from} to={to} />
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
const INK = '#2f3e4e';

/**
 * Net profit as a card in the spirit of a taka note (an original design, not
 * a copy of one): mint-to-peach paper, an engraved side band, a magpie-robin
 * on a branch, a watermark window holding the shop's logo, a fine engraved
 * strip along the bottom, and the gold chip of a bank card.
 */
function ProfitCard({ net, netMargin, brand, logo, from, to }: { net: number; netMargin: number | null; brand: string; logo: string | null; from: string; to: string }) {
  const loss = net < 0;
  return (
    <div
      className={`relative aspect-[85.6/54] w-full max-w-[25rem] select-none overflow-hidden rounded-[11px] shadow-[0_18px_40px_-14px_rgba(0,0,0,0.75)] ring-1 ring-black/10 ${loss
        ? 'bg-[linear-gradient(100deg,#f6dde2_0%,#fbeee6_45%,#fbd9c6_75%,#f1b8a8_100%)]'
        : 'bg-[linear-gradient(100deg,#c9ece1_0%,#e4f4ec_42%,#fbe5d3_74%,#f5c8a6_100%)]'}`}
      style={{ color: INK }}
      role="img"
      aria-label={`${loss ? 'Net loss' : 'Net profit'} ${money(net)}${netMargin !== null ? `, ${netMargin}% of income` : ''}, ${ddmm(from)} to ${ddmm(to)}, ${brand}`}
    >
      {/* Fine engraved lines across the paper. */}
      <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 400 252" preserveAspectRatio="none">
        {Array.from({ length: 14 }, (_, i) => (
          <path key={i} d={`M0 ${30 + i * 15} C 110 ${10 + i * 15}, 260 ${60 + i * 15}, 400 ${25 + i * 15}`} fill="none" stroke={INK} strokeOpacity="0.06" strokeWidth="0.8" />
        ))}
      </svg>

      {/* Left: the engraved side band. */}
      <div className="absolute inset-y-0 left-0 w-[8%] overflow-hidden" style={{ background: INK }}>
        <svg aria-hidden className="absolute inset-0 h-full w-full" viewBox="0 0 30 200" preserveAspectRatio="none">
          {Array.from({ length: 20 }, (_, i) => (
            <path key={i} d={`M0 ${i * 10} L15 ${i * 10 + 6} L30 ${i * 10}`} fill="none" stroke="#fff" strokeOpacity="0.18" strokeWidth="0.8" />
          ))}
        </svg>
        <span className="absolute left-1/2 top-[7%] -translate-x-1/2 text-[1.35rem] font-black leading-none text-white/90">৳</span>
      </div>

      {/* Right: the watermark window, holding the shop's logo. */}
      <div className="absolute right-[5%] top-[9%] grid aspect-square w-[34%] place-items-center rounded-full bg-[radial-gradient(circle,#ffffff_0%,#ffffffee_55%,#ffffff00_72%)]">
        <div className="absolute inset-[6%] rounded-full ring-1 ring-[#e8a77a]/50" />
        <MiniRosette />
        {logo
          // eslint-disable-next-line @next/next/no-img-element -- a small brand mark on the card
          ? <img src={logo} alt="" className="relative w-[78%] object-contain opacity-95" />
          : <span className="relative font-serif text-[1.3rem] font-bold italic" style={{ color: INK }}>{brand}</span>}
      </div>

      {/* The bird on its branch. */}
      <MagpieRobin className="absolute left-[28%] top-[21%] h-[45%] w-auto" />

      {/* Top: what the card shows, and a contactless mark. */}
      <div className="absolute left-[12%] right-[42%] top-[8%]">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.2em]">{loss ? 'Net loss' : 'Net profit'}</p>
        <p className="text-[11px] font-semibold opacity-60">{loss ? 'নিট লোকসান' : 'নিট লাভ'}</p>
      </div>

      {/* The gold chip. */}
      <Chip className="absolute left-[12%] top-[30%] h-[17%] w-auto" />

      {/* The amount, where a note says its value. */}
      <p className={`absolute bottom-[22%] right-[5%] text-right text-[clamp(1.35rem,5vw,2rem)] font-black leading-none tracking-tight lg:text-[1.85rem] ${loss ? 'text-[#9f1239]' : ''}`}
        style={{ textShadow: '0 1px 0 rgba(255,255,255,0.7)' }}>
        {money(net)}
      </p>

      {/* Bottom: the engraved strip with the period, and the shop's name. */}
      <div className="absolute inset-x-0 bottom-0 h-[19%] overflow-hidden" style={{ background: `linear-gradient(90deg, ${INK}ee, ${INK}cc)` }}>
        <svg aria-hidden className="absolute inset-0 h-full w-full" viewBox="0 0 400 48" preserveAspectRatio="none">
          {Array.from({ length: 9 }, (_, i) => (
            <path key={i} d={`M0 ${24 + Math.sin(i) * 4} ${Array.from({ length: 20 }, (_, k) => `Q ${k * 20 + 10} ${i % 2 ? 6 : 42} ${k * 20 + 20} 24`).join(' ')}`} fill="none" stroke="#fff" strokeOpacity="0.12" strokeWidth="0.7" />
          ))}
        </svg>
        <div className="relative flex h-full items-center justify-between pl-[11%] pr-[5%] text-white">
          <p className="font-mono text-[11px] tracking-wider text-white/85">
            <span className="mr-1.5 font-sans text-[7.5px] font-semibold uppercase tracking-wider text-white/55">Valid</span>
            {ddmm(from)} – {ddmm(to)}
          </p>
          {netMargin !== null && (
            <p className="text-[11px] font-bold tracking-wide text-[#f3d886]">{netMargin}% <span className="font-medium text-white/60">of income</span></p>
          )}
        </div>
      </div>

      {/* A soft sheen across the card. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_30%,rgba(255,255,255,0.35)_42%,transparent_52%)] mix-blend-soft-light" />
    </div>
  );
}

/** An original line drawing of a magpie-robin (doyel) on a leafy branch. */
function MagpieRobin({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 120 100" className={className}>
      <g fill={INK}>
        {/* tail, raised */}
        <path d="M44 56 L14 10 Q12 6 17 7 L50 50 Z" />
        {/* body */}
        <ellipse cx="62" cy="57" rx="23" ry="13" transform="rotate(-14 62 57)" />
        {/* head and beak */}
        <circle cx="84" cy="43" r="9.5" />
        <path d="M92.5 41.5 L105 44.5 L92.5 47 Z" />
      </g>
      {/* white wing bar and belly */}
      <path d="M48 52 Q63 44 77 49 Q64 53 49 58 Z" fill="#ffffff" fillOpacity="0.92" />
      <path d="M57 67 Q72 70 82 55 Q78 66 58 70 Z" fill="#ffffff" fillOpacity="0.85" />
      {/* eye */}
      <circle cx="86.5" cy="41" r="1.8" fill="#ffffff" />
      <circle cx="86.8" cy="41" r="0.9" fill={INK} />
      {/* legs */}
      <path d="M63 68 L61 80 M70 67 L70 80" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
      {/* branch with leaves */}
      <path d="M20 84 Q 64 74 116 86" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M96 82 Q 104 70 112 66" fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
      <g fill={INK} fillOpacity="0.85">
        <ellipse cx="34" cy="76" rx="5" ry="2.4" transform="rotate(-30 34 76)" />
        <ellipse cx="44" cy="87" rx="5" ry="2.4" transform="rotate(25 44 87)" />
        <ellipse cx="104" cy="72" rx="5" ry="2.4" transform="rotate(-40 104 72)" />
        <ellipse cx="112" cy="62" rx="4.5" ry="2.2" transform="rotate(-70 112 62)" />
        <ellipse cx="90" cy="88" rx="5" ry="2.4" transform="rotate(20 90 88)" />
      </g>
    </svg>
  );
}

/** A faint engraved rosette behind the logo in the watermark window. */
function MiniRosette() {
  const loop = (R: number, amp: number, k: number, phase: number) => {
    const pts: string[] = [];
    for (let i = 0; i <= 160; i++) {
      const t = (i / 160) * Math.PI * 2;
      const r = R + amp * Math.sin(k * t + phase);
      pts.push(`${(50 + r * Math.cos(t)).toFixed(2)},${(50 + r * Math.sin(t)).toFixed(2)}`);
    }
    return `M${pts.join(' L')}Z`;
  };
  return (
    <svg aria-hidden viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
      <g fill="none" stroke="#e8a77a" strokeWidth="0.35" strokeOpacity="0.55">
        {Array.from({ length: 6 }, (_, i) => <path key={i} d={loop(40, 5, 10, (i * Math.PI) / 6)} />)}
      </g>
    </svg>
  );
}

/** A gold EMV chip. */
function Chip({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 50 38" className={`${className ?? ''} drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]`}>
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
