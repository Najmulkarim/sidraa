'use client';

import { useState, useTransition } from 'react';
import { verifyPayment } from '@/actions/admin-payments';
import { formatBdPhone } from '@/lib/phone';

const WALLET: Record<string, string> = { bkash: 'bKash', nagad: 'Nagad' };
const STATUS: Record<string, { text: string; cls: string }> = {
  paid: { text: 'Paid', cls: 'bg-ok/10 text-ok' },
  pending: { text: 'Waiting', cls: 'bg-warn/10 text-warn' },
  failed: { text: 'Not paid', cls: 'bg-bad/10 text-bad' },
  none: { text: 'Cash on delivery', cls: 'bg-soft text-ink' },
};

/** Admin order page: how the customer chose to pay; manual payments get Received / Not received. */
export function PaymentPanel({ order, canEdit }: {
  order: { id: string; payment_method: string; payment_mode: string | null; payment_status: string; payment_sender: string | null; payment_trx_id: string | null };
  canEdit: boolean;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const st = STATUS[order.payment_status] ?? STATUS.none!;
  const wallet = WALLET[order.payment_method];

  if (!wallet) return <p className="text-sm">Cash on delivery</p>;
  const act = (received: boolean) => start(async () => {
    const r = await verifyPayment(order.id, received);
    setMsg({ ok: r.ok, text: r.message ?? '' });
  });

  return (
    <div className="space-y-3 text-sm">
      <p className="flex flex-wrap items-center gap-2">
        <b>{wallet}</b>
        <span className="text-muted">· {order.payment_mode === 'merchant' ? 'automatic (gateway)' : 'manual (Send Money)'}</span>
        <span className={`rounded-md px-2 py-0.5 text-[12px] font-semibold ${st.cls}`}>{st.text}</span>
      </p>
      {(order.payment_sender || order.payment_trx_id) && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          {order.payment_sender && <><dt className="text-muted">Sent from</dt><dd className="font-mono">{formatBdPhone(order.payment_sender)}</dd></>}
          {order.payment_trx_id && <><dt className="text-muted">TrxID</dt><dd className="font-mono font-semibold">{order.payment_trx_id}</dd></>}
        </dl>
      )}
      {canEdit && order.payment_mode === 'manual' && order.payment_status !== 'paid' && (
        <>
          <p className="text-[12.5px] text-muted">Check this TrxID in your {wallet} app, then:</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={pending} onClick={() => act(true)} className="btn btn-primary btn-sm">Payment received</button>
            {order.payment_status !== 'failed' && <button type="button" disabled={pending} onClick={() => act(false)} className="btn btn-outline btn-sm">Not received</button>}
          </div>
        </>
      )}
      {msg && <p role="status" className={msg.ok ? 'text-ok' : 'text-bad'}>{msg.text}</p>}
    </div>
  );
}
