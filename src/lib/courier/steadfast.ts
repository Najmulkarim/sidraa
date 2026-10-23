import 'server-only';
import { courierFetch } from './http';
import { CourierError, type Booking, type Parcel } from './types';

/** Steadfast (Packzy) API — https://portal.packzy.com/api/v1 by default. */
export type SteadfastConfig = { baseUrl: string; apiKey: string; secretKey: string };

const headers = (c: SteadfastConfig) => ({ 'Api-Key': c.apiKey, 'Secret-Key': c.secretKey });

export async function steadfastCreate(c: SteadfastConfig, p: Parcel, note: string | null): Promise<Booking> {
  type Res = { status?: number; message?: string; consignment?: { consignment_id?: number | string; tracking_code?: string; status?: string } };
  const r = await courierFetch<Res>(`${c.baseUrl}/create_order`, {
    method: 'POST',
    headers: headers(c),
    body: JSON.stringify({
      invoice: p.public_ref,
      recipient_name: p.customer_name,
      recipient_phone: p.customer_phone,
      recipient_address: p.address.slice(0, 250),
      cod_amount: p.cod_amount,
      note: [note, p.note].filter(Boolean).join(' · ').slice(0, 250) || undefined,
      item_description: p.item_description,
      total_lot: p.item_quantity,
    }),
  });
  const cid = r?.consignment?.consignment_id;
  if (r?.status !== 200 || cid === undefined || cid === null) throw new CourierError(r?.message || 'Steadfast did not accept the parcel.');
  return { consignment_id: String(cid), tracking_code: r.consignment?.tracking_code ?? null, status: r.consignment?.status ?? 'in_review', charge: null };
}

export async function steadfastStatus(c: SteadfastConfig, consignmentId: string): Promise<{ status: string; charge: number | null }> {
  type Res = { status?: number; delivery_status?: string; delivery_charge?: number | string };
  const r = await courierFetch<Res>(`${c.baseUrl}/status_by_cid/${encodeURIComponent(consignmentId)}`, { headers: headers(c) });
  if (!r?.delivery_status) throw new CourierError('Steadfast returned no status.');
  return { status: r.delivery_status, charge: r.delivery_charge === undefined || r.delivery_charge === null ? null : Number(r.delivery_charge) };
}

export async function steadfastBalance(c: SteadfastConfig): Promise<number> {
  const r = await courierFetch<{ status?: number; current_balance?: number | string }>(`${c.baseUrl}/get_balance`, { headers: headers(c) });
  if (r?.current_balance === undefined) throw new CourierError('Steadfast did not return a balance — check the API key and secret.');
  return Number(r.current_balance);
}
