/** Money and date formatting. Money is Taka with English digits; dates
 *  are stored in UTC and always shown in Asia/Dhaka. */

export const TIME_ZONE = 'Asia/Dhaka';

const taka = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** 1234.5 → "৳1,234.5"; accepts the numeric strings Postgres returns. */
export function formatTaka(value: number | string | null | undefined): string {
  const n = typeof value === 'string' ? Number(value) : value ?? 0;
  if (!Number.isFinite(n)) return '৳0';
  return `৳${taka.format(n)}`;
}

/** Parses a numeric column (supabase-js returns numeric as number or string). */
export function toNumber(value: number | string | null | undefined): number {
  const n = typeof value === 'string' ? Number(value) : value ?? 0;
  return Number.isFinite(n) ? n : 0;
}

const dateTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE, day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
});
const dateOnly = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, day: 'numeric', month: 'short', year: 'numeric' });

/** "23 Oct 2026, 4:05 pm" in Dhaka time. */
export function formatDateTime(iso: string | null | undefined): string {
  return iso ? dateTime.format(new Date(iso)) : '—';
}

/** "23 Oct 2026" in Dhaka time. */
export function formatDate(iso: string | Date | null | undefined): string {
  return iso ? dateOnly.format(typeof iso === 'string' ? new Date(iso) : iso) : '—';
}

/** Today's calendar date in Dhaka as YYYY-MM-DD. */
export function dhakaToday(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(now);
}

/** Adds whole days to a YYYY-MM-DD string (calendar arithmetic, no zone drift). */
export function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

/** Start of a Dhaka calendar day as a UTC ISO string (Dhaka is UTC+6, no DST). */
export function dhakaDayStartUtc(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d, -6)).toISOString();
}

export function isYmd(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

export type RangePreset = 'today' | 'yesterday' | '7d' | '30d' | '90d' | 'this-month' | 'last-month' | 'this-year' | 'custom';

/** Resolves a preset (or custom from/to) to an inclusive Dhaka date range. */
export function resolveRange(
  preset: string | undefined,
  from: string | undefined,
  to: string | undefined,
  now: Date = new Date(),
): { preset: RangePreset; from: string; to: string } {
  const today = dhakaToday(now);
  const [y, m] = today.split('-').map(Number) as [number, number];
  const monthStart = `${y}-${String(m).padStart(2, '0')}-01`;
  switch (preset) {
    case 'today':
      return { preset: 'today', from: today, to: today };
    case 'yesterday': {
      const d = addDays(today, -1);
      return { preset: 'yesterday', from: d, to: d };
    }
    case '30d':
      return { preset: '30d', from: addDays(today, -29), to: today };
    case '90d':
      return { preset: '90d', from: addDays(today, -89), to: today };
    case 'this-year':
      return { preset: 'this-year', from: `${y}-01-01`, to: today };
    case 'this-month':
      return { preset: 'this-month', from: monthStart, to: today };
    case 'last-month': {
      const lastEnd = addDays(monthStart, -1);
      return { preset: 'last-month', from: `${lastEnd.slice(0, 7)}-01`, to: lastEnd };
    }
    case 'custom':
      if (isYmd(from) && isYmd(to)) {
        const [a, b] = from <= to ? [from, to] : [to, from];
        // Cap at 366 days, matching report_summary().
        const capped = addDays(b, -366) > a ? addDays(b, -366) : a;
        return { preset: 'custom', from: capped, to: b };
      }
      return { preset: '7d', from: addDays(today, -6), to: today };
    default:
      return { preset: '7d', from: addDays(today, -6), to: today };
  }
}
