import 'server-only';
import { courierFetch } from './http';
import { CourierError, type Booking, type Parcel, type PathaoLocation } from './types';

/** Pathao Courier merchant API (Aladdin). */
export type PathaoConfig = {
  sandbox: boolean;
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  storeId: string;
  token: string | null;
  tokenExpiresAt: string | null;
  weightKg: number;
};

export const pathaoBase = (sandbox: boolean) => (sandbox ? 'https://courier-api-sandbox.pathao.com' : 'https://api-hermes.pathao.com');

/** A valid access token: the cached one, or a fresh one (onNewToken stores it). */
export async function pathaoToken(c: PathaoConfig, onNewToken: (token: string, expiresAt: Date) => Promise<void>): Promise<string> {
  if (c.token && c.tokenExpiresAt && new Date(c.tokenExpiresAt).getTime() - Date.now() > 10 * 60_000) return c.token;
  type Res = { access_token?: string; expires_in?: number };
  const r = await courierFetch<Res>(`${pathaoBase(c.sandbox)}/aladdin/api/v1/issue-token`, {
    method: 'POST',
    body: JSON.stringify({ client_id: c.clientId, client_secret: c.clientSecret, grant_type: 'password', username: c.username, password: c.password }),
  });
  if (!r?.access_token) throw new CourierError('Pathao did not issue a token — check the client ID, secret, email and password.');
  const expires = new Date(Date.now() + Math.max(60, Number(r.expires_in) || 3600) * 1000);
  await onNewToken(r.access_token, expires);
  return r.access_token;
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

export async function pathaoCreate(c: PathaoConfig, token: string, p: Parcel, note: string | null, loc: PathaoLocation): Promise<Booking> {
  type Res = { code?: number; message?: string; data?: { consignment_id?: string; order_status?: string; delivery_fee?: number | string } };
  const r = await courierFetch<Res>(`${pathaoBase(c.sandbox)}/aladdin/api/v1/orders`, {
    method: 'POST',
    headers: auth(token),
    body: JSON.stringify({
      store_id: Number(c.storeId),
      merchant_order_id: p.public_ref,
      recipient_name: p.customer_name,
      recipient_phone: p.customer_phone,
      recipient_address: p.address.slice(0, 220),
      ...(loc.city_id ? { recipient_city: loc.city_id } : {}),
      ...(loc.zone_id ? { recipient_zone: loc.zone_id } : {}),
      ...(loc.area_id ? { recipient_area: loc.area_id } : {}),
      delivery_type: 48, // normal delivery
      item_type: 2, // parcel
      special_instruction: [note, p.note].filter(Boolean).join(' · ').slice(0, 250) || undefined,
      item_quantity: Math.max(1, p.item_quantity),
      item_weight: Math.min(10, Math.max(0.5, c.weightKg)),
      amount_to_collect: Math.round(p.cod_amount),
      item_description: p.item_description,
    }),
  });
  const cid = r?.data?.consignment_id;
  if (!cid) throw new CourierError(r?.message || 'Pathao did not accept the parcel.');
  return { consignment_id: String(cid), tracking_code: null, status: r.data?.order_status ?? 'Pending', charge: r.data?.delivery_fee === undefined ? null : Number(r.data.delivery_fee) };
}

export async function pathaoStatus(c: PathaoConfig, token: string, consignmentId: string): Promise<{ status: string; charge: number | null }> {
  type Res = { data?: { order_status?: string; order_status_slug?: string; delivery_fee?: number | string } };
  const r = await courierFetch<Res>(`${pathaoBase(c.sandbox)}/aladdin/api/v1/orders/${encodeURIComponent(consignmentId)}/info`, { headers: auth(token) });
  const status = r?.data?.order_status_slug || r?.data?.order_status;
  if (!status) throw new CourierError('Pathao returned no status.');
  return { status, charge: r.data?.delivery_fee === undefined ? null : Number(r.data.delivery_fee) };
}

export type PathaoPlace = { id: number; name: string };

/** City → zone → area lists for the send dialog. */
export async function pathaoPlaces(c: PathaoConfig, token: string, kind: 'city' | 'zone' | 'area', parentId?: number): Promise<PathaoPlace[]> {
  const path =
    kind === 'city' ? '/aladdin/api/v1/city-list' : kind === 'zone' ? `/aladdin/api/v1/cities/${parentId}/zone-list` : `/aladdin/api/v1/zones/${parentId}/area-list`;
  type Row = { city_id?: number; city_name?: string; zone_id?: number; zone_name?: string; area_id?: number; area_name?: string };
  const r = await courierFetch<{ data?: { data?: Row[] } }>(`${pathaoBase(c.sandbox)}${path}`, { headers: auth(token) });
  return (r?.data?.data ?? [])
    .map((x) => ({ id: Number(x.city_id ?? x.zone_id ?? x.area_id), name: String(x.city_name ?? x.zone_name ?? x.area_name ?? '') }))
    .filter((x) => Number.isFinite(x.id) && x.name);
}
