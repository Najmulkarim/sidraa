import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

/** public.payment_settings (service role only: it holds gateway secrets). */
export type PaymentSettingsRow = {
  cod_enabled: boolean;
  bkash_manual: boolean;
  bkash_number: string | null;
  bkash_number_type: 'personal' | 'agent' | 'merchant';
  nagad_manual: boolean;
  nagad_number: string | null;
  nagad_number_type: 'personal' | 'agent' | 'merchant';
  bkash_merchant: boolean;
  bkash_sandbox: boolean;
  bkash_app_key: string | null;
  bkash_app_secret: string | null;
  bkash_username: string | null;
  bkash_password: string | null;
  nagad_merchant: boolean;
  nagad_sandbox: boolean;
  nagad_merchant_id: string | null;
  nagad_public_key: string | null;
  nagad_private_key: string | null;
};

const DEFAULTS: PaymentSettingsRow = {
  cod_enabled: true, bkash_manual: false, bkash_number: null, bkash_number_type: 'personal', nagad_manual: false, nagad_number: null, nagad_number_type: 'personal',
  bkash_merchant: false, bkash_sandbox: true, bkash_app_key: null, bkash_app_secret: null, bkash_username: null, bkash_password: null,
  nagad_merchant: false, nagad_sandbox: true, nagad_merchant_id: null, nagad_public_key: null, nagad_private_key: null,
};

/** Before migration 0021 runs the table is missing: behave as cash on delivery only. */
export async function readPaymentSettings(): Promise<PaymentSettingsRow> {
  const { data, error } = await createAdminClient().from('payment_settings').select('*').eq('id', 1).maybeSingle<PaymentSettingsRow>();
  if (error || !data) return DEFAULTS;
  return data;
}

export const bkashMerchantReady = (s: PaymentSettingsRow) => s.bkash_merchant && !!(s.bkash_app_key && s.bkash_app_secret && s.bkash_username && s.bkash_password);
// Nagad's gateway is switched on once the shop has its merchant keys (see Settings → Payments).
export const nagadMerchantReady = (_s: PaymentSettingsRow) => false;

export type PayMethod = 'cod' | 'bkash' | 'nagad';
export type PayMode = 'manual' | 'merchant';

/** What checkout may offer — no secrets. */
export type PaymentOptions = {
  cod: boolean;
  bkash: { manual: { number: string; type: string } | null; merchant: boolean };
  nagad: { manual: { number: string; type: string } | null; merchant: boolean };
};

export function paymentOptions(s: PaymentSettingsRow): PaymentOptions {
  const bkashManual = s.bkash_manual && s.bkash_number ? { number: s.bkash_number, type: s.bkash_number_type } : null;
  const nagadManual = s.nagad_manual && s.nagad_number ? { number: s.nagad_number, type: s.nagad_number_type } : null;
  const bkashMerchant = bkashMerchantReady(s);
  const nagadMerchant = nagadMerchantReady(s);
  const anyOnline = !!(bkashManual || nagadManual || bkashMerchant || nagadMerchant);
  return {
    // Cash on delivery stays on when nothing else is set up, so checkout always works.
    cod: s.cod_enabled || !anyOnline,
    bkash: { manual: bkashManual, merchant: bkashMerchant },
    nagad: { manual: nagadManual, merchant: nagadMerchant },
  };
}

export function allows(o: PaymentOptions, method: PayMethod, mode: PayMode | null): boolean {
  if (method === 'cod') return o.cod;
  const m = o[method];
  return mode === 'manual' ? !!m.manual : mode === 'merchant' ? m.merchant : false;
}
