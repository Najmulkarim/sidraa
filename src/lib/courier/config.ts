import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import type { PathaoConfig } from './pathao';
import type { SteadfastConfig } from './steadfast';

/**
 * Reads courier secrets with the service role. Call ONLY after the caller's
 * permission was checked against the database (begin_courier_send /
 * has_permission) or from a webhook/cron that authenticated itself.
 */
export type CourierSettingsRow = {
  default_courier: 'steadfast' | 'pathao' | null;
  steadfast_base_url: string;
  steadfast_api_key: string | null;
  steadfast_secret_key: string | null;
  steadfast_webhook_token: string | null;
  pathao_sandbox: boolean;
  pathao_client_id: string | null;
  pathao_client_secret: string | null;
  pathao_username: string | null;
  pathao_password: string | null;
  pathao_store_id: string | null;
  pathao_webhook_secret: string | null;
  pathao_integration_secret: string | null;
  pathao_token: string | null;
  pathao_token_expires_at: string | null;
  default_weight_kg: number | string;
  parcel_note: string | null;
  auto_sync: boolean;
};

export async function readCourierSettings(): Promise<CourierSettingsRow> {
  const { data, error } = await createAdminClient().from('courier_settings').select('*').eq('id', 1).single();
  if (error || !data) throw new Error(`courier settings: ${error?.message ?? 'missing row'}`);
  return data as CourierSettingsRow;
}

export function steadfastConfig(s: CourierSettingsRow): SteadfastConfig | null {
  return s.steadfast_api_key && s.steadfast_secret_key
    ? { baseUrl: s.steadfast_base_url.replace(/\/+$/, ''), apiKey: s.steadfast_api_key, secretKey: s.steadfast_secret_key }
    : null;
}

export function pathaoConfig(s: CourierSettingsRow): PathaoConfig | null {
  if (!s.pathao_client_id || !s.pathao_client_secret || !s.pathao_username || !s.pathao_password || !s.pathao_store_id) return null;
  return {
    sandbox: s.pathao_sandbox,
    clientId: s.pathao_client_id,
    clientSecret: s.pathao_client_secret,
    username: s.pathao_username,
    password: s.pathao_password,
    storeId: s.pathao_store_id,
    token: s.pathao_token,
    tokenExpiresAt: s.pathao_token_expires_at,
    weightKg: Number(s.default_weight_kg) || 0.5,
  };
}

export async function savePathaoToken(token: string, expiresAt: Date) {
  await createAdminClient().from('courier_settings').update({ pathao_token: token, pathao_token_expires_at: expiresAt.toISOString() }).eq('id', 1);
}
