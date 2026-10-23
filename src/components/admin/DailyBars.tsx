import { formatDate, formatTaka } from '@/lib/format';

type Day = { day: string; placed: number; delivered_revenue: number | string };

/**
 * Single-series bar chart: delivered revenue per Dhaka day. One hue (the
 * brand colour), thin bars with a 2px gap, rounded data ends on the
 * baseline, a per-bar hover tooltip, and the same numbers as a table.
 */
export function DailyBars({ days }: { days: Day[] }) {
  const values = days.map((d) => Number(d.delivered_revenue) || 0);
  const max = Math.max(1, ...values);
  const showEvery = Math.ceil(days.length / 10);

  return (
    <figure className="space-y-3">
      <figcaption className="text-sm font-semibold">Delivered revenue per day</figcaption>
      <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-line" aria-hidden="true" />
        <span className="absolute -top-2.5 right-0 bg-card pl-1 text-[11px] text-muted">{formatTaka(max)}</span>
        <ol className="flex h-48 items-end gap-[2px] pt-4" aria-label="Delivered revenue per day">
          {days.map((d, i) => {
            const v = values[i] ?? 0;
            const h = v === 0 ? 0 : Math.max(2, (v / max) * 100);
            return (
              <li key={d.day} className="group relative flex h-full flex-1 items-end" tabIndex={0} aria-label={`${formatDate(d.day)}: ${formatTaka(v)}, ${d.placed} orders placed`}>
                <span className="block w-full rounded-t-[4px] bg-brand transition-opacity group-hover:opacity-80" style={{ height: `${h}%` }} />
                <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-xs text-white shadow group-hover:block group-focus:block">
                  {formatDate(d.day)}<br />{formatTaka(v)} · {d.placed} placed
                </span>
              </li>
            );
          })}
        </ol>
        <div className="mt-1 flex gap-[2px] border-t border-line pt-1 text-[10px] text-muted" aria-hidden="true">
          {days.map((d, i) => (
            <span key={d.day} className="flex-1 truncate text-center">{i % showEvery === 0 ? d.day.slice(5).replace('-', '/') : ''}</span>
          ))}
        </div>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted">Show as table</summary>
        <table className="table mt-2">
          <thead><tr><th>Day</th><th className="text-right">Orders placed</th><th className="text-right">Delivered revenue</th></tr></thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.day}><td>{formatDate(d.day)}</td><td className="text-right">{d.placed}</td><td className="text-right">{formatTaka(d.delivered_revenue)}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
