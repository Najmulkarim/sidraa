import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { pathaoConfig, savePathaoToken, steadfastConfig, type CourierSettingsRow } from './config';
import { pathaoStatus, pathaoToken } from './pathao';
import { steadfastStatus } from './steadfast';
import { CourierError, type CourierName } from './types';

/** Asks the courier for one parcel's status and applies it (service role). */
export async function syncParcel(settings: CourierSettingsRow, courier: CourierName, consignmentId: string) {
  let result: { status: string; charge: number | null };
  if (courier === 'steadfast') {
    const c = steadfastConfig(settings);
    if (!c) throw new CourierError('Steadfast is not set up.');
    result = await steadfastStatus(c, consignmentId);
  } else {
    const c = pathaoConfig(settings);
    if (!c) throw new CourierError('Pathao is not set up.');
    const token = await pathaoToken(c, savePathaoToken);
    result = await pathaoStatus(c, token, consignmentId);
  }
  return applyCourierStatus(courier, consignmentId, result.status, result.charge);
}

export async function applyCourierStatus(courier: CourierName, consignmentId: string, status: string, charge: number | null) {
  const { data, error } = await createAdminClient().rpc('apply_courier_status', {
    p_courier: courier,
    p_consignment_id: consignmentId,
    p_raw_status: status.slice(0, 60),
    p_charge: charge !== null && Number.isFinite(charge) ? charge : null,
  });
  if (error) throw new Error(`apply_courier_status: ${error.message}`);
  return { raw: status, ...(data as { found: boolean; status?: string }) };
}
