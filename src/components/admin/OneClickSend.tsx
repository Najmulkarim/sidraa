'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { autoSendToCourier } from '@/actions/admin-courier';
import { COURIER_LABEL, type CourierName } from '@/lib/courier/types';
import { Icon } from '../icons';
import { notify } from './Toaster';

const KEY = 'sidraa:courier-capacity';

/**
 * Orders toolbar: send the oldest confirmed orders to the courier in one
 * click, as many as today's capacity (remembered on this computer).
 */
export function OneClickSend({ couriers, defaultCourier, ready }: { couriers: CourierName[]; defaultCourier: CourierName | null; ready: number }) {
  const [courier, setCourier] = useState<CourierName>(defaultCourier && couriers.includes(defaultCourier) ? defaultCourier : couriers[0]!);
  const [cap, setCap] = useState(20);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(KEY));
      if (saved >= 1 && saved <= 50) setCap(saved);
    } catch { /* storage blocked: keep 20 */ }
  }, []);

  const count = Math.min(cap, ready, 50);
  function send() {
    setMsg(null);
    try { localStorage.setItem(KEY, String(cap)); } catch { /* ignore */ }
    start(async () => {
      const r = await autoSendToCourier(courier, count);
      setMsg({ ok: r.ok, text: r.message ?? '' });
      notify(r.ok, r.message);
      router.refresh();
    });
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3 text-[13px]">
      <span className="flex items-center gap-1.5 font-semibold"><Icon name="truck" size={16} className="text-brand" /> 1-click courier</span>
      <span className="text-muted">{ready} confirmed order{ready === 1 ? '' : 's'} ready ·</span>
      <label className="flex items-center gap-1.5">
        <span className="text-muted">Capacity today</span>
        <input type="number" min={1} max={50} value={cap} onChange={(e) => setCap(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} className="input min-h-9 w-20 py-1" />
      </label>
      {couriers.length > 1 && (
        <select aria-label="Courier" value={courier} onChange={(e) => setCourier(e.target.value as CourierName)} className="input min-h-9 w-auto py-1">
          {couriers.map((c) => <option key={c} value={c}>{COURIER_LABEL[c]}</option>)}
        </select>
      )}
      <button type="button" onClick={send} disabled={pending || count < 1} className="btn btn-primary btn-sm min-h-9">
        <Icon name="send" size={14} /> {pending ? 'Sending…' : count < 1 ? 'Nothing to send' : `Send ${count} to ${COURIER_LABEL[courier]}`}
      </button>
      {msg && <span role="status" className={msg.ok ? 'text-ok' : 'text-bad'}>{msg.text}</span>}
    </div>
  );
}
