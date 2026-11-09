'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { setCodRate } from '@/actions/accounting';
import { formatDateTime } from '@/lib/format';

type Rate = { cod_rate: number | string; effective_from: string };

/** A courier's COD fee rate: the one in force now, a change that applies from now on, and the history. */
export function CodRateSetting({ courier, name, rates }: { courier: string; name: string; rates: Rate[] }) {
  const router = useRouter();
  const sorted = [...rates].sort((a, b) => new Date(b.effective_from).getTime() - new Date(a.effective_from).getTime());
  const now = sorted[0] ? Number(sorted[0].cod_rate) : 1;
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(now));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();

  const save = () => {
    const rate = Number(value);
    if (!Number.isFinite(rate) || rate < 0 || rate > 20) { setMsg({ ok: false, text: 'Enter a rate between 0 and 20%' }); return; }
    start(async () => {
      const r = await setCodRate(courier, rate);
      setMsg({ ok: r.ok, text: r.message ?? '' });
      if (r.ok) { setOpen(false); router.refresh(); }
    });
  };

  return (
    <div className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[13px] text-muted">{name} COD fee</p>
          <p className="text-[1.3rem] font-bold leading-tight">{now}% <span className="text-[13px] font-medium text-muted">of the cash collected</span></p>
        </div>
        {!open && <button type="button" onClick={() => { setOpen(true); setMsg(null); }} className="btn btn-sm border border-line bg-white">Change</button>}
      </div>
      {open && (
        <div className="space-y-2 rounded-xl bg-soft p-3">
          <label className="flex flex-wrap items-center gap-2 text-[13.5px]">
            New rate
            <input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} className="input h-9 w-24 px-2 py-1 text-right" aria-label="New COD fee rate in percent" />
            %
          </label>
          <p className="text-[12px] text-muted">Applies to parcels handed to {name} from now on. Parcels handed over earlier keep their old rate, and checked parcels never change.</p>
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={save} className="btn btn-primary btn-sm disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button>
            <button type="button" onClick={() => setOpen(false)} className="btn btn-sm border border-line bg-white">Cancel</button>
          </div>
        </div>
      )}
      {msg && <p className={`text-[12.5px] ${msg.ok ? 'text-ok' : 'text-bad'}`}>{msg.text}</p>}
      {sorted.length > 1 && (
        <details className="text-[12.5px] text-muted">
          <summary className="cursor-pointer">Rate history</summary>
          <ul className="mt-1.5 space-y-0.5">
            {sorted.map((r, i) => (
              <li key={i}>{Number(r.cod_rate)}% — {new Date(r.effective_from).getFullYear() <= 2000 ? 'from the start' : `from ${formatDateTime(r.effective_from)}`}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
