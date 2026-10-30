'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth';
import { pathaoConfig, readCourierSettings, savePathaoToken, steadfastConfig } from '@/lib/courier/config';
import { pathaoCreate, pathaoPlaces, pathaoToken, type PathaoPlace } from '@/lib/courier/pathao';
import { steadfastBalance, steadfastCreate } from '@/lib/courier/steadfast';
import { syncParcel } from '@/lib/courier/sync';
import { COURIER_LABEL, CourierError, type Booking, type CourierName, type Parcel, type PathaoLocation } from '@/lib/courier/types';
import { mapDbError } from '@/lib/db-errors';
import type { ActionState } from '@/lib/types';

const courierSchema = z.enum(['steadfast', 'pathao']);
const locSchema = z.object({ city_id: z.number().int().positive().optional(), zone_id: z.number().int().positive().optional(), area_id: z.number().int().positive().optional() });

function refresh(orderId?: string) {
  revalidatePath('/admin/orders');
  revalidatePath('/admin');
  if (orderId) revalidatePath(`/admin/orders/${orderId}`);
}

/**
 * Books one parcel. Flow:
 *   1. begin_courier_send() — as the signed-in staff member: checks the
 *      "courier" permission, refuses double booking, returns the parcel
 *      (amount to collect etc.) from the database.
 *   2. Courier API call with keys read by the service role on the server.
 *   3. record_courier_booking() (order → In courier) or fail_courier_send().
 */
async function sendOne(supabase: Awaited<ReturnType<typeof requirePermission>>['supabase'], orderId: string, courier: CourierName, loc: PathaoLocation): Promise<ActionState> {
  const { data: parcel, error } = await supabase.rpc('begin_courier_send', { p_order_id: orderId });
  if (error || !parcel) return { ok: false, message: mapDbError(error).message };
  const p = parcel as Parcel & { id: string };

  let booking: Booking;
  try {
    const settings = await readCourierSettings();
    if (courier === 'steadfast') {
      const c = steadfastConfig(settings);
      if (!c) throw new CourierError('Steadfast is not set up yet — add the API key and secret in Settings → Courier.');
      booking = await steadfastCreate(c, p, settings.parcel_note);
    } else {
      const c = pathaoConfig(settings);
      if (!c) throw new CourierError('Pathao is not set up yet — add the credentials and store ID in Settings → Courier.');
      const token = await pathaoToken(c, savePathaoToken);
      booking = await pathaoCreate(c, token, p, settings.parcel_note, loc);
    }
  } catch (e) {
    const message = e instanceof CourierError ? e.message : 'Could not send to the courier. Try again.';
    if (!(e instanceof CourierError)) console.error('[courier] send', e);
    await supabase.rpc('fail_courier_send', { p_order_id: orderId, p_error: message });
    return { ok: false, message: `${p.public_ref}: ${message}` };
  }

  const { error: recErr } = await supabase.rpc('record_courier_booking', {
    p_order_id: orderId,
    p_courier: courier,
    p_consignment_id: booking.consignment_id,
    p_tracking_code: booking.tracking_code,
    p_status: booking.status,
    p_charge: booking.charge,
  });
  if (recErr) {
    // The courier has the parcel but we could not save it: say so loudly.
    console.error('[courier] record booking', recErr);
    return { ok: false, message: `${p.public_ref} was booked with ${COURIER_LABEL[courier]} (consignment ${booking.consignment_id}) but saving failed. Note the consignment and contact support.` };
  }
  return { ok: true, message: `${p.public_ref} sent to ${COURIER_LABEL[courier]} — consignment ${booking.consignment_id}.` };
}

export async function sendToCourier(orderId: string, courier: string, loc: unknown = {}): Promise<ActionState> {
  const { supabase } = await requirePermission('courier');
  const id = z.uuid().safeParse(orderId);
  const c = courierSchema.safeParse(courier);
  const l = locSchema.safeParse(loc ?? {});
  if (!id.success || !c.success || !l.success) return { ok: false, message: 'Invalid request.' };
  const r = await sendOne(supabase, id.data, c.data, l.data);
  refresh(id.data);
  return r;
}

/** Bulk send, one by one (couriers rate-limit bursts). Max 50 per click. */
export async function bulkSendToCourier(ids: string[], courier: string): Promise<ActionState> {
  const { supabase } = await requirePermission('courier');
  const parsed = z.object({ ids: z.array(z.uuid()).min(1).max(50, 'At most 50 parcels at a time'), courier: courierSchema }).safeParse({ ids, courier });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Invalid request.' };
  let sent = 0;
  const failed: string[] = [];
  for (const id of parsed.data.ids) {
    const r = await sendOne(supabase, id, parsed.data.courier, {});
    if (r.ok) sent++;
    else failed.push(r.message ?? id);
  }
  refresh();
  return {
    ok: sent > 0,
    message: `${sent} sent to ${COURIER_LABEL[parsed.data.courier]}.${failed.length ? ` ${failed.length} not sent: ${failed.slice(0, 3).join(' · ')}${failed.length > 3 ? ' …' : ''}` : ''}`,
  };
}

/**
 * One click: books the oldest Ready to deliver orders (not yet with a
 * courier), up to `max` — the number you can
 * hand over today. One by one, like bulk send.
 */
export async function autoSendToCourier(courier: string, max: number): Promise<ActionState & { sent?: number; left?: number }> {
  const { supabase } = await requirePermission('courier');
  const parsed = z.object({ courier: courierSchema, max: z.number().int().min(1).max(50) }).safeParse({ courier, max });
  if (!parsed.success) return { ok: false, message: 'Choose how many to send (1–50).' };
  const ready = () =>
    supabase.from('orders').select('id', { count: 'exact' }).eq('status', 'processing').is('courier_consignment_id', null).is('deleted_at', null);
  const { data: rows, error } = await ready().order('created_at', { ascending: true }).limit(parsed.data.max);
  if (error) return { ok: false, message: mapDbError(error).message };
  if (!rows?.length) return { ok: false, message: 'No Ready to deliver orders are waiting to be sent.', sent: 0, left: 0 };
  let sent = 0;
  const failed: string[] = [];
  for (const { id } of rows as { id: string }[]) {
    const r = await sendOne(supabase, id, parsed.data.courier, {});
    if (r.ok) sent++;
    else failed.push(r.message ?? id);
  }
  const { count } = await ready().limit(1);
  refresh();
  const notSent = failed.length ? ` ${failed.length} not sent: ${failed.slice(0, 3).join(' · ')}${failed.length > 3 ? ' …' : ''}` : '';
  return {
    ok: sent > 0,
    sent,
    left: count ?? 0,
    message: `${sent} sent to ${COURIER_LABEL[parsed.data.courier]}.${notSent}${count ? ` ${count} still waiting.` : ''}`,
  };
}

/** "Refresh" on a parcel: asks the courier now instead of waiting for the webhook/cron. */
export async function refreshCourierStatus(orderId: string): Promise<ActionState> {
  const { supabase } = await requirePermission('courier');
  if (!z.uuid().safeParse(orderId).success) return { ok: false, message: 'Invalid request.' };
  const { data: o } = await supabase.from('orders').select('courier, courier_consignment_id').eq('id', orderId).maybeSingle();
  if (!o?.courier || !o.courier_consignment_id) return { ok: false, message: 'This order has not been sent to a courier.' };
  try {
    const r = await syncParcel(await readCourierSettings(), o.courier as CourierName, o.courier_consignment_id);
    refresh(orderId);
    return { ok: true, message: `Courier says: ${r.raw}.` };
  } catch (e) {
    if (!(e instanceof CourierError)) console.error('[courier] refresh', e);
    return { ok: false, message: e instanceof CourierError ? e.message : 'Could not reach the courier.' };
  }
}

/** Pathao city / zone / area pickers. */
export async function getPathaoPlaces(kind: 'city' | 'zone' | 'area', parentId?: number): Promise<{ ok: boolean; places: PathaoPlace[]; message?: string }> {
  await requirePermission('courier');
  if (!['city', 'zone', 'area'].includes(kind) || (kind !== 'city' && !(Number.isInteger(parentId) && parentId! > 0))) return { ok: false, places: [] };
  try {
    const c = pathaoConfig(await readCourierSettings());
    if (!c) return { ok: false, places: [], message: 'Pathao is not set up.' };
    const token = await pathaoToken(c, savePathaoToken);
    return { ok: true, places: await pathaoPlaces(c, token, kind, parentId) };
  } catch (e) {
    return { ok: false, places: [], message: e instanceof CourierError ? e.message : 'Could not load the list from Pathao.' };
  }
}

/** "Test connection" in Settings → Courier. */
export async function testCourier(courier: string): Promise<ActionState> {
  await requirePermission('courier_settings');
  const c = courierSchema.safeParse(courier);
  if (!c.success) return { ok: false, message: 'Invalid request.' };
  try {
    const settings = await readCourierSettings();
    if (c.data === 'steadfast') {
      const cfg = steadfastConfig(settings);
      if (!cfg) return { ok: false, message: 'Add the Steadfast API key and secret first.' };
      const balance = await steadfastBalance(cfg);
      return { ok: true, message: `Connected to Steadfast. Balance ৳${balance.toLocaleString('en-US')}.` };
    }
    const cfg = pathaoConfig(settings);
    if (!cfg) return { ok: false, message: 'Fill in every Pathao field first.' };
    await pathaoToken({ ...cfg, token: null }, savePathaoToken);
    return { ok: true, message: `Connected to Pathao${cfg.sandbox ? ' (sandbox)' : ''}.` };
  } catch (e) {
    return { ok: false, message: e instanceof CourierError ? e.message : 'Could not reach the courier.' };
  }
}
