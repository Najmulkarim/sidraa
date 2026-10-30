'use server';

import { unstable_cache } from 'next/cache';
import { requirePermission } from '@/lib/auth';
import { ownHistory, parseCourierHistory, type CourierRow, type OwnOrder } from '@/lib/courier/history';
import { COURIER_LABEL, type CourierName } from '@/lib/courier/types';

const API = 'https://api.bdcourier.com/courier-check';

/** Thrown, not returned, so a failed lookup is never cached. */
const lookup = unstable_cache(
  async (phone: string, key: string) => {
    const res = await fetch(API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ phone }),
      signal: AbortSignal.timeout(12_000),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`BD Courier answered ${res.status}`);
    const parsed = parseCourierHistory(await res.json());
    if (!parsed) throw new Error('BD Courier sent an answer we could not read');
    return parsed;
  },
  ['bd-courier-history'],
  { revalidate: 7 * 24 * 3600 },
);

export type CustomerHistory = {
  ok: boolean;
  message?: string;
  own?: { couriers: CourierRow[]; pickupCancelled: number; total: number };
  /** Across all shops. null: not connected yet, or the lookup failed (see external). */
  all?: { couriers: CourierRow[]; summary: CourierRow } | null;
  external?: 'on' | 'off' | 'failed';
};

/** The record behind the % in the orders list. The phone number leaves this site only when the key is set. */
export async function getCustomerHistory(phone: string): Promise<CustomerHistory> {
  const { supabase } = await requirePermission('orders');
  if (!/^01[0-9]{9}$/.test(phone)) return { ok: false, message: 'Invalid phone number.' };

  const { data, error } = await supabase.from('orders').select('courier, status, courier_status').eq('customer_phone', phone).is('deleted_at', null).limit(1000);
  if (error) {
    console.error('[admin] customer history', error);
    return { ok: false, message: 'Could not load this customer.' };
  }
  const own = ownHistory((data ?? []) as OwnOrder[], (c) => COURIER_LABEL[c as CourierName] ?? c);

  const key = process.env.BD_COURIER_API_KEY;
  if (!key) return { ok: true, own, all: null, external: 'off' };
  try {
    return { ok: true, own, all: await lookup(phone, key), external: 'on' };
  } catch (e) {
    console.error('[admin] BD Courier', e);
    return { ok: true, own, all: null, external: 'failed' };
  }
}
