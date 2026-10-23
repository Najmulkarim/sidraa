/**
 * Integration tests run against a LOCAL Supabase stack:
 *   supabase start && supabase db reset     (migrations + seed)
 *   npm run test:integration
 * They read the local keys from `supabase status -o env` style variables.
 * Never point them at production: they create users and orders.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

export const URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const PUBLISHABLE = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.ANON_KEY;
const SECRET = process.env.SUPABASE_SECRET_KEY ?? process.env.SERVICE_ROLE_KEY;

if (!/127\.0\.0\.1|localhost/.test(URL)) {
  throw new Error(`Refusing to run integration tests against ${URL}. Use a local Supabase stack.`);
}
if (!PUBLISHABLE || !SECRET) {
  throw new Error('Set SUPABASE_PUBLISHABLE_KEY (or ANON_KEY) and SUPABASE_SECRET_KEY (or SERVICE_ROLE_KEY) from `supabase status`.');
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
export const anon = (): SupabaseClient => createClient(URL, PUBLISHABLE, opts);
export const service = (): SupabaseClient => createClient(URL, SECRET, opts);

export const ZONE_INSIDE = '0b6c3c2e-0000-4000-8000-000000000001';
export const ZONE_OUTSIDE = '0b6c3c2e-0000-4000-8000-000000000003';
export const V = {
  maxiM: 'b0000000-0000-4000-8000-000000000102',
  maxiXL: 'b0000000-0000-4000-8000-000000000104',
  scarf: 'b0000000-0000-4000-8000-000000000601',
  draft: 'b0000000-0000-4000-8000-000000000701',
};

export function orderPayload(items: { variant_id: string; quantity: number }[], extra: Record<string, unknown> = {}) {
  return {
    idempotency_key: randomUUID(),
    customer_name: 'Integration Test',
    customer_phone: `017${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`,
    address: 'House 1, Road 1, Test Area',
    district: 'Dhaka',
    zone_id: ZONE_INSIDE,
    items,
    ...extra,
  };
}

export async function stockOf(variantId: string): Promise<number> {
  const { data, error } = await service().from('product_variants').select('stock').eq('id', variantId).single();
  if (error) throw error;
  return data.stock as number;
}

/** Sets a variant's stock directly (service role) — test setup only. */
export async function setStock(variantId: string, stock: number) {
  const { error } = await service().from('product_variants').update({ stock }).eq('id', variantId);
  if (error) throw error;
}

/** Creates a confirmed user, optionally an admin, and returns a client signed in as them. */
export async function userClient(role: 'super_admin' | 'manager' | 'support' | null): Promise<{ client: SupabaseClient; userId: string }> {
  const email = `test-${randomUUID()}@example.test`;
  const password = `pw-${randomUUID()}`;
  const admin = service();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error('createUser failed');
  if (role) {
    const { error: pErr } = await admin.from('admin_profiles').insert({ user_id: data.user.id, full_name: `Test ${role}`, role });
    if (pErr) throw pErr;
  }
  const client = anon();
  const { error: sErr } = await client.auth.signInWithPassword({ email, password });
  if (sErr) throw sErr;
  return { client, userId: data.user.id };
}
