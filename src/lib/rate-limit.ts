import 'server-only';
import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Postgres-backed fixed-window limits (public.hit_rate_limit). Keys are
 * salted SHA-256 hashes, so raw IPs and phone numbers are never stored.
 * Fails closed: if the limiter cannot be reached, the action is refused.
 */
export const LIMITS = {
  checkoutIp: { max: 5, windowSeconds: 600 },
  checkoutPhone: { max: 3, windowSeconds: 3600 },
  trackIp: { max: 10, windowSeconds: 600 },
  loginIp: { max: 5, windowSeconds: 900 },
  loginEmail: { max: 10, windowSeconds: 3600 },
} as const;

export function hashKey(value: string): string {
  const salt = process.env.RATE_LIMIT_SALT;
  if (!salt || salt.length < 16) throw new Error('RATE_LIMIT_SALT must be set (32+ random characters).');
  return createHash('sha256').update(`${salt}:${value}`).digest('hex').slice(0, 32);
}

/** Best-effort client IP. On Vercel the first x-forwarded-for entry is the client. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || h.get('x-real-ip') || 'unknown';
}

export async function hit(scope: string, rawKey: string, limit: { max: number; windowSeconds: number }): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc('hit_rate_limit', {
    p_bucket: `${scope}:${hashKey(rawKey)}`,
    p_max_hits: limit.max,
    p_window_seconds: limit.windowSeconds,
  });
  if (error) {
    console.error('[rate-limit] failed', scope, error.message);
    return false;
  }
  return data === true;
}
