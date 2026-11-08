'use client';

import { useEffect, useState } from 'react';

/** Time left on the offer's real end date (the coupon's end). Hides itself once it ends. */
export function OfferCountdown({ endsAt }: { endsAt: string }) {
  const end = Date.parse(endsAt);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (now === null || !Number.isFinite(end) || end <= now) return null;
  const s = Math.floor((end - now) / 1000);
  const parts = [
    { n: Math.floor(s / 86400), l: 'Days' },
    { n: Math.floor((s % 86400) / 3600), l: 'Hours' },
    { n: Math.floor((s % 3600) / 60), l: 'Min' },
    { n: s % 60, l: 'Sec' },
  ];
  return (
    <div className="flex items-center gap-3" role="timer" aria-label="Offer ends in">
      <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">Offer ends in</span>
      <span className="flex gap-1.5">
        {parts.map((p) => (
          <span key={p.l} className="grid min-w-12 place-items-center rounded-lg bg-night px-2 py-1 text-white">
            <span className="font-mono text-lg font-bold leading-none tabular-nums">{String(p.n).padStart(2, '0')}</span>
            <span className="text-[9.5px] uppercase tracking-wide text-white/70">{p.l}</span>
          </span>
        ))}
      </span>
    </div>
  );
}
