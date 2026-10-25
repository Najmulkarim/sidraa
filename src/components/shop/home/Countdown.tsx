'use client';

import { useEffect, useState } from 'react';

/** Days / hours / minutes / seconds until `endsAt`. Renders nothing once the time has passed. */
export function Countdown({ endsAt, tone = 'light' }: { endsAt: string; tone?: 'light' | 'dark' }) {
  const end = Date.parse(endsAt);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (now === null) return <div className="h-14" aria-hidden="true" />;
  const left = Math.max(0, end - now);
  if (left === 0) return null;
  const parts = [
    ['Days', Math.floor(left / 86_400_000)],
    ['Hrs', Math.floor(left / 3_600_000) % 24],
    ['Mins', Math.floor(left / 60_000) % 60],
    ['Secs', Math.floor(left / 1000) % 60],
  ] as const;
  const box = tone === 'dark' ? 'bg-white/15 text-white ring-white/25' : 'bg-card text-night ring-line';
  return (
    <div className="flex gap-2" role="timer" aria-label={`Ends in ${parts.map(([l, v]) => `${v} ${l}`).join(' ')}`}>
      {parts.map(([label, v]) => (
        <span key={label} className={`grid w-14 place-items-center rounded-lg py-1.5 ring-1 ${box}`}>
          <span className="text-[1.35rem] font-bold tabular-nums leading-tight">{String(v).padStart(2, '0')}</span>
          <span className="text-[10.5px] uppercase tracking-wide opacity-70">{label}</span>
        </span>
      ))}
    </div>
  );
}
