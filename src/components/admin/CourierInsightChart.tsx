import { formatTaka } from '@/lib/format';
import type { Insight } from '@/lib/courier-insight';

/** The courier's "Order insight": a ring of parcel groups and one tile per group. */
export function CourierInsightChart({ groups, count, amount }: Pick<Insight, 'groups' | 'count' | 'amount'>) {
  return (
    <section className="card grid gap-6 p-5 sm:p-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-center">
      <Donut groups={groups} count={count} amount={amount} />
      <ul className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
        {groups.map((g) => (
          <li key={g.key} className="min-w-0">
            <p className="flex items-center gap-2 text-[13.5px] font-medium text-ink/85">
              <span className="h-3 w-3 shrink-0 rounded-[4px]" style={{ background: g.color }} aria-hidden />
              {g.label}
            </p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="text-[1.6rem] font-bold leading-none">{g.count}</span>
              <span className="rounded-md bg-soft px-1.5 py-0.5 text-[11.5px] font-semibold text-muted">{g.pct}%</span>
            </p>
            <p className="mt-1 text-[13.5px] text-muted">{formatTaka(g.amount)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Ring of parcel groups with the total in the middle; each slice names itself on hover. */
function Donut({ groups, count, amount }: Pick<Insight, 'groups' | 'count' | 'amount'>) {
  const size = 200, stroke = 26, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const shown = groups.filter((g) => g.count > 0);
  const gap = shown.length > 1 ? 2 : 0;
  let offset = 0;
  return (
    <div className="relative mx-auto h-[200px] w-[200px]">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90" role="img" aria-label={`${count} parcels: ${shown.map((g) => `${g.label} ${g.count}`).join(', ') || 'none'}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-soft)" strokeWidth={stroke} />
        {shown.map((g) => {
          const len = (g.count / count) * c;
          const el = (
            <circle key={g.key} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={g.color} strokeWidth={stroke}
              strokeDasharray={`${Math.max(0, len - gap)} ${c}`} strokeDashoffset={-offset}>
              <title>{`${g.label}: ${g.count}`}</title>
            </circle>
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
        <p className="text-[12.5px] font-semibold text-muted">Total parcels</p>
        <p className="text-[2.2rem] font-bold leading-none">{count}</p>
        <p className="mt-1 text-[13px] font-medium">{formatTaka(amount)}</p>
      </div>
    </div>
  );
}
