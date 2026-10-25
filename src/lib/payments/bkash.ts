import 'server-only';
import type { PaymentSettingsRow } from './settings';

/**
 * bKash Tokenized Checkout (v1.2.0-beta): grant token → create payment →
 * customer pays on bKash's page → callback → execute. Sandbox and live use
 * the same calls on different hosts.
 */
export class BkashError extends Error {}

type Conf = { base: string; appKey: string; appSecret: string; username: string; password: string };

function conf(s: PaymentSettingsRow): Conf {
  if (!s.bkash_app_key || !s.bkash_app_secret || !s.bkash_username || !s.bkash_password) throw new BkashError('bKash merchant is not set up.');
  return {
    base: s.bkash_sandbox ? 'https://tokenized.sandbox.bka.sh/v1.2.0-beta' : 'https://tokenized.pay.bka.sh/v1.2.0-beta',
    appKey: s.bkash_app_key, appSecret: s.bkash_app_secret, username: s.bkash_username, password: s.bkash_password,
  };
}

// The id_token lasts an hour; keep it for 50 minutes per server instance.
let cached: { key: string; token: string; until: number } | null = null;

async function call<T>(url: string, headers: Record<string, string>, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(20_000), cache: 'no-store' });
  } catch {
    throw new BkashError('Could not reach bKash. Please try again.');
  }
  const data = (await res.json().catch(() => null)) as (T & { statusCode?: string; statusMessage?: string; errorMessage?: string }) | null;
  if (!data) throw new BkashError(`bKash answered ${res.status}.`);
  return data;
}

async function token(c: Conf): Promise<string> {
  const key = `${c.base}|${c.username}|${c.appKey}`;
  if (cached && cached.key === key && cached.until > Date.now()) return cached.token;
  const r = await call<{ id_token?: string; statusCode?: string; statusMessage?: string }>(`${c.base}/tokenized/checkout/token/grant`, { username: c.username, password: c.password }, { app_key: c.appKey, app_secret: c.appSecret });
  if (!r.id_token) throw new BkashError(`bKash login failed: ${r.statusMessage ?? 'check the merchant credentials'}`);
  cached = { key, token: r.id_token, until: Date.now() + 50 * 60_000 };
  return r.id_token;
}

const auth = async (c: Conf) => ({ Authorization: await token(c), 'X-App-Key': c.appKey });

/** Starts a payment; the customer is sent to `bkashURL`. */
export async function bkashCreate(s: PaymentSettingsRow, p: { amount: number; invoice: string; payer: string; callbackURL: string }): Promise<{ paymentID: string; bkashURL: string }> {
  const c = conf(s);
  const r = await call<{ paymentID?: string; bkashURL?: string; statusMessage?: string; errorMessage?: string }>(`${c.base}/tokenized/checkout/create`, await auth(c), {
    mode: '0011',
    payerReference: p.payer,
    callbackURL: p.callbackURL,
    amount: p.amount.toFixed(2),
    currency: 'BDT',
    intent: 'sale',
    merchantInvoiceNumber: p.invoice,
  });
  if (!r.paymentID || !r.bkashURL) throw new BkashError(r.statusMessage ?? r.errorMessage ?? 'bKash could not start the payment.');
  return { paymentID: r.paymentID, bkashURL: r.bkashURL };
}

export type BkashResult = { completed: boolean; trxID: string | null; amount: number | null; message: string };

/** Finishes a payment after the callback; falls back to a status query if it was already executed. */
export async function bkashExecute(s: PaymentSettingsRow, paymentID: string): Promise<BkashResult> {
  const c = conf(s);
  type R = { transactionStatus?: string; trxID?: string; amount?: string; statusCode?: string; statusMessage?: string; errorMessage?: string };
  let r = await call<R>(`${c.base}/tokenized/checkout/execute`, await auth(c), { paymentID });
  if (r.transactionStatus !== 'Completed') {
    const q = await call<R>(`${c.base}/tokenized/checkout/payment/status`, await auth(c), { paymentID });
    if (q.transactionStatus) r = q;
  }
  return {
    completed: r.transactionStatus === 'Completed',
    trxID: r.trxID ?? null,
    amount: r.amount ? Number(r.amount) : null,
    message: r.statusMessage ?? r.errorMessage ?? r.transactionStatus ?? 'Unknown',
  };
}
