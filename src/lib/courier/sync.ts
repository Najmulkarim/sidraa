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

export async function applyCourierStatus(courier: CourierName, consignmentId: string, status: string, charge: number | null, collected: number | null = null) {
  const { data, error } = await createAdminClient().rpc('apply_courier_status', {
    p_courier: courier,
    p_consignment_id: consignmentId,
    p_raw_status: status.slice(0, 60),
    p_charge: charge !== null && Number.isFinite(charge) ? charge : null,
    p_collected: collected !== null && Number.isFinite(collected) ? collected : null,
  });
  if (error) throw new Error(`apply_courier_status: ${error.message}`);
  return { raw: status, ...(data as { found: boolean; status?: string }) };
}

const money = (v: unknown) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/**
 * Keeps a webhook message (for checking the figures later) and the exact money
 * it reports for the parcel: what the courier collected and its COD fee.
 * Never throws: the status update has already been saved.
 */
export async function recordCourierEvent(courier: CourierName, consignmentId: string, event: string, body: Record<string, unknown>, found: { collected?: unknown; codFee?: unknown }) {
  try {
    const db = createAdminClient();
    const collected = money(found.collected);
    const codFee = money(found.codFee);
    await Promise.all([
      db.from('courier_events').insert({ courier, consignment_id: consignmentId.slice(0, 60), event: event.slice(0, 60), payload: body }),
      collected !== null || codFee !== null
        ? db.from('orders').update({ ...(collected !== null ? { courier_collected: collected } : {}), ...(codFee !== null ? { courier_cod_fee: codFee } : {}) })
            .eq('courier', courier).eq('courier_consignment_id', consignmentId)
        : null,
    ]);
  } catch (e) {
    console.error('[webhook] could not keep the courier message', e);
  }
}
