import 'server-only';
import { errorMessage } from './http-errors';
import { CourierError } from './types';

/** JSON request with a timeout; turns courier error bodies into readable messages. */
export async function courierFetch<T>(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const { timeoutMs = 15_000, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(rest.headers ?? {}) },
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    });
  } catch (e) {
    throw new CourierError(e instanceof Error && e.name === 'TimeoutError' ? 'The courier did not answer in time. Try again.' : 'Could not reach the courier. Check the internet connection and try again.');
  }
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) throw new CourierError(errorMessage(body) ?? `Courier error (HTTP ${res.status}).`, res.status);
  return body as T;
}

