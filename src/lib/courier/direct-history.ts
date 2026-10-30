import 'server-only';
import { unstable_cache } from 'next/cache';
import { pathaoConfig, readCourierSettings, savePathaoToken, steadfastConfig } from './config';
import { parseDirectHistory, type CourierRow, type DirectResult } from './history';
import { courierFetch } from './http';
import { pathaoBase, pathaoToken } from './pathao';

const DENIED = /unauthori[sz]ed|forbidden|permission|not allowed/i;

/** Failures are thrown, so only a real answer is kept (seven days per number). */
const lookupPathao = unstable_cache(async (phone: string): Promise<CourierRow> => {
  const c = pathaoConfig(await readCourierSettings());
  if (!c) throw new Error('off');
  const token = await pathaoToken(c, savePathaoToken);
  const body = await courierFetch<{ error?: boolean; message?: string }>(`${pathaoBase(c.sandbox)}/aladdin/api/v1/user/success-rate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ phone }),
  });
  if (body?.error) throw new Error(body.message ?? 'denied');
  const row = parseDirectHistory('Pathao', body);
  if (!row) throw new Error('unreadable');
  return row;
}, ['pathao-history'], { revalidate: 7 * 24 * 3600 });

const lookupSteadfast = unstable_cache(async (phone: string): Promise<CourierRow> => {
  const c = steadfastConfig(await readCourierSettings());
  if (!c) throw new Error('off');
  const body = await courierFetch<unknown>(`${c.baseUrl}/fraud_check/score/${phone}`, { headers: { 'Api-Key': c.apiKey, 'Secret-Key': c.secretKey } });
  const row = parseDirectHistory('Steadfast', body);
  if (!row) throw new Error('unreadable');
  return row;
}, ['steadfast-history'], { revalidate: 7 * 24 * 3600 });

async function one(name: string, read: () => Promise<CourierRow>): Promise<DirectResult> {
  try {
    return { name, state: 'ok', row: await read() };
  } catch (e) {
    const message = e instanceof Error ? e.message : '';
    if (message === 'off') return { name, state: 'off' };
    if (DENIED.test(message)) return { name, state: 'denied' };
    console.error(`[admin] ${name} history`, message);
    return { name, state: message === 'unreadable' ? 'unreadable' : 'failed' };
  }
}

/** Pathao and Steadfast, each on its own: one failing never hides the other. */
export function directHistory(phone: string): Promise<DirectResult[]> {
  return Promise.all([one('Pathao', () => lookupPathao(phone)), one('Steadfast', () => lookupSteadfast(phone))]);
}
