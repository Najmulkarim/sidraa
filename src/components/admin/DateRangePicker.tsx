'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../icons';

export const RANGE_PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'this-month', label: 'This month' },
  { value: 'last-month', label: 'Last month' },
  { value: 'this-year', label: 'This year' },
] as const;

const WEEK = ['Sa', 'Su', 'Mo', 'Tu', 'We', 'Th', 'Fr'];
const MONTH = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const SHORT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const SHORT_Y = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

const utc = (ymd: string) => new Date(`${ymd}T00:00:00Z`);
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const plusDays = (s: string, n: number) => { const d = utc(s); d.setUTCDate(d.getUTCDate() + n); return ymd(d); };
const spanDays = (a: string, b: string) => Math.round((utc(b).getTime() - utc(a).getTime()) / 86400000) + 1;
const monthStart = (s: string, add = 0) => { const d = utc(s); return ymd(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + add, 1))); };

function label(from: string, to: string) {
  if (from === to) return SHORT_Y.format(utc(from));
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return `${(sameYear ? SHORT : SHORT_Y).format(utc(from))} – ${SHORT_Y.format(utc(to))}`;
}

/**
 * One button that opens quick ranges plus a calendar (click a start day, then an end day).
 * The arrows beside it step to the previous / next period of the same length.
 * `today` is the shop's (Dhaka) date, so "future" days match the server.
 */
/** presets: the quick ranges to offer; keep: other query parameters to carry over (e.g. group=month). */
export function DateRangePicker({ basePath, preset, from, to, today, presets = RANGE_PRESETS, keep = '' }: { basePath: string; preset: string; from: string; to: string; today: string; presets?: readonly { value: string; label: string }[]; keep?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState<string | null>(from);
  const [end, setEnd] = useState<string | null>(to);
  const [hover, setHover] = useState<string | null>(null);
  const [view, setView] = useState(() => monthStart(to, -1));
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);

  function toggle() {
    if (!open) { setStart(from); setEnd(to); setView(monthStart(to, -1)); }
    setOpen(!open);
  }

  function go(q: string) {
    setOpen(false);
    router.push(`${basePath}?${keep ? `${keep}&` : ''}${q}`);
  }
  const goCustom = (a: string, b: string) => go(`range=custom&from=${a}&to=${b}`);

  function pick(day: string) {
    if (!start || end) { setStart(day); setEnd(null); return; }
    if (day < start) { setEnd(start); setStart(day); } else setEnd(day);
  }

  // Previous / next period of the same length.
  const len = spanDays(from, to);
  const prev = () => goCustom(plusDays(from, -len), plusDays(to, -len));
  const next = () => {
    const b = plusDays(to, len) > today ? today : plusDays(to, len);
    goCustom(plusDays(b, -(len - 1)), b);
  };

  const name = presets.find((p) => p.value === preset)?.label ?? 'Custom range';
  const lo = start && (end ?? hover) ? (start < (end ?? hover)! ? start : (end ?? hover)!) : start;
  const hi = start && (end ?? hover) ? (start < (end ?? hover)! ? (end ?? hover)! : start) : start;

  return (
    <div ref={box} className="relative flex items-center gap-1">
      <button type="button" onClick={prev} aria-label="Previous period" className="grid h-9 w-9 place-items-center rounded-lg bg-card ring-1 ring-line transition hover:ring-brand">
        <Icon name="arrow" size={15} className="rotate-180" />
      </button>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="flex h-9 items-center gap-2 rounded-lg bg-card px-3 text-[13px] ring-1 ring-line transition hover:ring-brand"
      >
        <Icon name="calendar" size={16} className="text-brand" />
        <span className={`font-semibold ${preset === 'custom' ? 'hidden sm:inline' : ''}`}>{name}</span>
        {preset !== 'all' && <span className={preset === 'custom' ? 'text-ink sm:text-muted' : 'hidden text-muted sm:inline'}><span className="hidden sm:inline">· </span>{label(from, to)}</span>}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className={`transition ${open ? 'rotate-180' : ''}`} aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      <button type="button" onClick={next} disabled={to >= today} aria-label="Next period" className="grid h-9 w-9 place-items-center rounded-lg bg-card ring-1 ring-line transition hover:ring-brand disabled:opacity-40 disabled:hover:ring-line">
        <Icon name="arrow" size={15} />
      </button>

      {open && (
        <>
        {/* Phones: a sheet from the bottom over a dimmed page; wider screens: a panel under the button. */}
        <div className="fixed inset-0 z-40 bg-night/50 backdrop-blur-[1px] md:hidden" onClick={() => setOpen(false)} aria-hidden="true" />
        <div role="dialog" aria-label="Choose dates" className="fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col overflow-y-auto rounded-t-2xl bg-card pb-[env(safe-area-inset-bottom)] shadow-[0_-20px_50px_-20px_rgba(20,10,30,.45)] md:absolute md:inset-x-auto md:bottom-auto md:right-0 md:top-11 md:z-30 md:max-h-none md:w-[44rem] md:flex-row md:overflow-hidden md:rounded-2xl md:pb-0 md:shadow-[0_24px_60px_-20px_rgba(20,10,30,.45)] md:ring-1 md:ring-line">
          <div className="flex items-center justify-between border-b border-line px-4 py-3 md:hidden">
            <p className="font-semibold">Choose dates</p>
            <button type="button" onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-soft" aria-label="Close"><Icon name="x" size={18} /></button>
          </div>
          <ul className="grid grid-cols-2 gap-1.5 border-b border-line p-3 md:flex md:w-40 md:flex-col md:gap-1 md:border-b-0 md:border-r md:p-2">
            {presets.map((p) => (
              <li key={p.value}>
                <button
                  type="button"
                  onClick={() => go(`range=${p.value}`)}
                  className={`w-full whitespace-nowrap rounded-lg px-3 py-2.5 text-left text-[13.5px] font-medium ring-1 transition md:py-2 md:text-[13px] md:ring-0 ${preset === p.value ? 'bg-tint text-brand-ink ring-brand/30' : 'ring-line hover:bg-soft'}`}
                >
                  {p.label}
                </button>
              </li>
            ))}
          </ul>

          <div className="flex-1 p-3">
            <div className="grid gap-4 sm:grid-cols-2">
              {[0, 1].map((k) => (
                <Month
                  key={k}
                  first={monthStart(view, k)}
                  today={today}
                  lo={lo}
                  hi={hi}
                  onPick={pick}
                  onHover={setHover}
                  onPrev={k === 0 ? () => setView(monthStart(view, -1)) : undefined}
                  onNext={() => setView(monthStart(view, 1))}
                  nextDisabled={monthStart(view, k + 1) > today}
                  nextPhoneOnly={k === 0}
                  className={k === 1 ? 'hidden sm:block' : ''}
                />
              ))}
            </div>
            <div className="sticky bottom-0 -mx-3 -mb-3 mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line bg-card px-3 py-3 md:static md:mx-0 md:mb-0 md:px-0 md:pb-0">
              <p className="text-[12.5px] text-muted">
                {start && end ? <><b className="text-ink">{label(start, end)}</b> · {spanDays(start, end)} day{spanDays(start, end) === 1 ? '' : 's'}</> : start ? 'Now pick the last day' : 'Pick the first day'}
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost btn-sm">Cancel</button>
                <button type="button" disabled={!start || !end} onClick={() => start && end && goCustom(start, end)} className="btn btn-primary btn-sm">Apply</button>
              </div>
            </div>
          </div>
        </div>
        </>
      )}
    </div>
  );
}

function Month({ first, today, lo, hi, onPick, onHover, onPrev, onNext, nextDisabled, nextPhoneOnly, className = '' }: {
  first: string; today: string; lo: string | null; hi: string | null;
  onPick: (d: string) => void; onHover: (d: string | null) => void;
  onPrev?: () => void; onNext: () => void; nextDisabled: boolean; nextPhoneOnly: boolean; className?: string;
}) {
  const d = utc(first);
  const days = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  const lead = (d.getUTCDay() + 1) % 7; // week starts on Saturday
  const cells: (string | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: days }, (_, i) => plusDays(first, i))];

  return (
    <div className={className} onMouseLeave={() => onHover(null)}>
      <div className="mb-2 flex h-8 items-center justify-between">
        {onPrev ? <button type="button" onClick={onPrev} aria-label="Earlier month" className="grid h-8 w-8 place-items-center rounded-lg hover:bg-soft"><Icon name="arrow" size={14} className="rotate-180" /></button> : <span className="w-8" />}
        <p className="text-[13px] font-semibold">{MONTH.format(d)}</p>
        {/* On phones only one month shows, so it carries both arrows. */}
        <button type="button" onClick={onNext} disabled={nextDisabled} aria-label="Later month" className={`h-8 w-8 place-items-center rounded-lg hover:bg-soft disabled:opacity-30 ${nextPhoneOnly ? 'grid sm:invisible' : 'grid'}`}><Icon name="arrow" size={14} /></button>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-muted">
        {WEEK.map((w) => <span key={w} className="py-1">{w}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5 text-center text-[14px] md:text-[12.5px]">
        {cells.map((day, i) => {
          if (!day) return <span key={`e${i}`} />;
          const future = day > today;
          const edge = day === lo || day === hi;
          const inside = lo && hi && day > lo && day < hi;
          return (
            <button
              key={day}
              type="button"
              disabled={future}
              onClick={() => onPick(day)}
              onMouseEnter={() => onHover(day)}
              aria-pressed={edge || !!inside}
              className={`h-10 rounded-lg transition md:h-8 disabled:cursor-not-allowed disabled:opacity-30 ${
                edge ? 'bg-brand font-bold text-white' : inside ? 'rounded-none bg-tint text-brand-ink' : 'hover:bg-soft'
              } ${day === today && !edge ? 'font-bold text-brand' : ''}`}
            >
              {Number(day.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
