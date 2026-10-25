/** A Postgres numeric arrives as a string or number. */
type Numeric = string | number;

/** Five stars filled to the average, from approved customer reviews. Shows nothing until a product has one. */
export function Stars({ avg, count, size = 13, showCount = true, className = '' }: { avg: Numeric | null; count: number; size?: number; showCount?: boolean; className?: string }) {
  const value = Number(avg ?? 0);
  if (!count || !value) return null;
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} aria-label={`Rated ${value.toFixed(1)} out of 5 by ${count} customer${count === 1 ? '' : 's'}`}>
      <span className="relative inline-block leading-none" style={{ fontSize: size, letterSpacing: '0.08em' }} aria-hidden="true">
        <span className="text-[#d9d4dc]">★★★★★</span>
        <span className="absolute inset-y-0 left-0 overflow-hidden whitespace-nowrap text-[#f59e0b]" style={{ width: `${pct}%` }}>★★★★★</span>
      </span>
      {showCount && <span className="text-[11.5px] text-ink/55" aria-hidden="true">({count})</span>}
    </span>
  );
}
