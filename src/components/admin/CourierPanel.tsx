'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { refreshCourierStatus } from '@/actions/admin-courier';
import { COURIER_LABEL, courierStatusLabel } from '@/lib/courier/types';
import { formatDateTime } from '@/lib/format';
import type { ActionState } from '@/lib/types';
import { Icon } from '../icons';
import type { CourierOptions, OrderRow } from './OrdersTable';
import { SendCourierDialog } from './SendCourierDialog';

/** Courier box on the order page: book the parcel, see and refresh its status. */
export function CourierPanel({ order, couriers, canSend, open }: { order: OrderRow & { courier_sent_at: string | null; courier_synced_at: string | null; courier_charge: number | string | null }; couriers: CourierOptions | null; canSend: boolean; open: boolean }) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<ActionState | null>(null);
  const [pending, start] = useTransition();

  if (order.courier && order.courier_consignment_id) {
    return (
      <div className="space-y-2 text-sm">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-muted">Courier</dt><dd className="font-semibold">{COURIER_LABEL[order.courier]}</dd>
          <dt className="text-muted">Consignment</dt><dd className="font-mono">{order.courier_consignment_id}</dd>
          {order.courier_tracking_code && (<><dt className="text-muted">Tracking code</dt><dd className="font-mono">{order.courier_tracking_code}</dd></>)}
          <dt className="text-muted">Courier status</dt><dd className="font-semibold text-[#0369a1]">{courierStatusLabel(order.courier_status) || '—'}</dd>
          {order.courier_charge !== null && (<><dt className="text-muted">Courier charge</dt><dd>৳{Number(order.courier_charge)}</dd></>)}
          <dt className="text-muted">Sent</dt><dd>{formatDateTime(order.courier_sent_at)}</dd>
          <dt className="text-muted">Last checked</dt><dd>{formatDateTime(order.courier_synced_at)}</dd>
        </dl>
        {canSend && order.status === 'shipped' && (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={pending}
            onClick={() => start(async () => { const r = await refreshCourierStatus(order.id); setMsg(r); router.refresh(); })}
          >
            <Icon name="refresh" size={14} /> {pending ? 'Checking…' : 'Check status now'}
          </button>
        )}
        {msg && <p role="status" className={`text-[12.5px] ${msg.ok ? 'text-ok' : 'text-bad'}`}>{msg.message}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2 text-sm">
      {order.courier_error && <p className="rounded-lg bg-bad/10 px-3 py-2 text-[12.5px] text-bad">Last attempt failed: {order.courier_error}</p>}
      {!open ? (
        <p className="text-muted">Not sent to a courier.</p>
      ) : canSend ? (
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setSending(true)}><Icon name="send" size={15} /> Send to courier</button>
      ) : (
        <p className="text-muted">Not sent yet. Your role cannot book parcels.</p>
      )}
      {msg && <p role="status" className={`text-[12.5px] ${msg.ok ? 'text-ok' : 'text-bad'}`}>{msg.message}</p>}
      {sending && couriers && (
        <SendCourierDialog order={order} couriers={couriers} onClose={() => setSending(false)} onDone={(r) => { setMsg(r); setSending(false); router.refresh(); }} />
      )}
    </div>
  );
}
