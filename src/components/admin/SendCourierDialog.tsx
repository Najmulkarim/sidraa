'use client';

import { useEffect, useState, useTransition } from 'react';
import { getPathaoPlaces, sendToCourier } from '@/actions/admin-courier';
import { COURIER_LABEL, type CourierName } from '@/lib/courier/types';
import { formatTaka, toNumber } from '@/lib/format';
import type { ActionState } from '@/lib/types';
import { Icon } from '../icons';
import type { CourierOptions, OrderRow } from './OrdersTable';

type Place = { id: number; name: string };

/** Book one parcel. The amount to collect is read from the database on the server. */
export function SendCourierDialog({ order, couriers, onClose, onDone }: { order: OrderRow; couriers: CourierOptions; onClose: () => void; onDone: (r: ActionState) => void }) {
  const ready = (['steadfast', 'pathao'] as CourierName[]).filter((c) => couriers[c]);
  const [courier, setCourier] = useState<CourierName>(couriers.default_courier && couriers[couriers.default_courier] ? couriers.default_courier : ready[0] ?? 'steadfast');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [cities, setCities] = useState<Place[] | null>(null);
  const [zones, setZones] = useState<Place[]>([]);
  const [areas, setAreas] = useState<Place[]>([]);
  const [loc, setLoc] = useState<{ city_id?: number; zone_id?: number; area_id?: number }>({});
  const [placesError, setPlacesError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (courier !== 'pathao' || cities) return;
    getPathaoPlaces('city').then((r) => (r.ok ? setCities(r.places) : (setCities([]), setPlacesError(r.message ?? 'Could not load cities.'))));
  }, [courier, cities]);

  const pickCity = (id: number) => {
    setLoc({ city_id: id || undefined });
    setZones([]);
    setAreas([]);
    if (id) getPathaoPlaces('zone', id).then((r) => setZones(r.places));
  };
  const pickZone = (id: number) => {
    setLoc((l) => ({ city_id: l.city_id, zone_id: id || undefined }));
    setAreas([]);
    if (id) getPathaoPlaces('area', id).then((r) => setAreas(r.places));
  };

  const due = Math.max(0, toNumber(order.total) - toNumber(order.paid_amount));

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-night/40 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="sc-title" onClick={(e) => e.stopPropagation()} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
        <header className="flex items-start justify-between">
          <div>
            <h2 id="sc-title" className="text-lg font-bold">Send to courier</h2>
            <p className="font-mono text-[12px] text-muted">{order.public_ref} · {order.customer_name}</p>
          </div>
          <button type="button" className="grid h-9 w-9 place-items-center rounded-lg hover:bg-soft" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
        </header>

        {ready.length === 0 ? (
          <p className="rounded-lg bg-warn/10 px-3 py-2 text-[13px] text-warn">No courier is set up yet. A super admin can add Steadfast or Pathao keys in Settings → Courier.</p>
        ) : (
          <>
            <fieldset className="grid grid-cols-2 gap-2">
              <legend className="label mb-1">Courier</legend>
              {ready.map((c) => (
                <label key={c} className={`flex cursor-pointer items-center gap-2 rounded-xl border-[1.5px] px-3 py-2.5 text-[13.5px] font-semibold ${courier === c ? 'border-brand bg-tint text-brand' : 'border-line'}`}>
                  <input type="radio" name="courier" value={c} checked={courier === c} onChange={() => setCourier(c)} className="accent-[var(--brand)]" />
                  {COURIER_LABEL[c]}
                </label>
              ))}
            </fieldset>

            {courier === 'pathao' && (
              <div className="space-y-2">
                <p className="text-[12px] text-muted">City and zone help Pathao route the parcel faster. Leave empty to let Pathao read the address.</p>
                {placesError && <p className="error">{placesError}</p>}
                <div className="grid grid-cols-3 gap-2">
                  <select aria-label="City" className="input min-h-9 py-1 text-[12.5px]" value={loc.city_id ?? ''} onChange={(e) => pickCity(Number(e.target.value))} disabled={!cities}>
                    <option value="">{cities ? 'City' : 'Loading…'}</option>
                    {cities?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <select aria-label="Zone" className="input min-h-9 py-1 text-[12.5px]" value={loc.zone_id ?? ''} onChange={(e) => pickZone(Number(e.target.value))} disabled={!zones.length}>
                    <option value="">Zone</option>
                    {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
                  </select>
                  <select aria-label="Area" className="input min-h-9 py-1 text-[12.5px]" value={loc.area_id ?? ''} onChange={(e) => setLoc((l) => ({ ...l, area_id: Number(e.target.value) || undefined }))} disabled={!areas.length}>
                    <option value="">Area</option>
                    {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </div>
            )}

            <dl className="space-y-1 rounded-xl bg-soft p-3 text-[13px]">
              <div className="flex justify-between"><dt className="text-muted">Address</dt><dd className="max-w-[65%] text-right">{order.address}{order.area ? `, ${order.area}` : ''}, {order.district}</dd></div>
              <div className="flex justify-between font-semibold"><dt>Rider collects</dt><dd className="font-mono text-brand">{formatTaka(due)}</dd></div>
            </dl>
            {error && <p role="alert" className="rounded-lg bg-bad/10 px-3 py-2 text-[13px] text-bad">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={pending}
                aria-busy={pending}
                onClick={() =>
                  start(async () => {
                    setError(null);
                    const r = await sendToCourier(order.id, courier, courier === 'pathao' ? loc : {});
                    if (r.ok) onDone(r);
                    else setError(r.message ?? 'Could not send.');
                  })
                }
              >
                <Icon name="send" size={16} /> {pending ? 'Sending…' : `Send to ${COURIER_LABEL[courier]}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
