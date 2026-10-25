'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { CATALOG_TAG } from '@/lib/catalog';
import { z } from 'zod';
import { requirePermission, requireSuperAdmin } from '@/lib/auth';
import { PERMISSIONS, isPermission } from '@/lib/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { mapDbError } from '@/lib/db-errors';
import { IMAGE_BUCKET } from '@/lib/env';
import type { ActionState } from '@/lib/types';
import { courierSettingsSchema, fieldErrors, formToObject, settingsSchema, staffSchema, zoneSchema } from '@/lib/validation';

/** Needs store_settings (also enforced by RLS on store_settings / delivery_zones). */
export async function saveSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requirePermission('store_settings');
  const parsed = settingsSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, message: 'Please fix the highlighted fields.', fieldErrors: fieldErrors(parsed.error) };
  const s = parsed.data;

  const social = Object.fromEntries(
    (['facebook', 'instagram', 'tiktok', 'youtube'] as const).flatMap((k) => (s[k] ? [[k, s[k]]] : [])),
  );
  const { error } = await supabase
    .from('store_settings')
    .update({
      store_name: s.storeName,
      tagline: s.tagline ?? null,
      phone: s.phone ?? null,
      email: s.email ?? null,
      address: s.address ?? null,
      social,
      cod_terms: s.codTerms,
      return_policy_days: s.returnPolicyDays,
      ...(s.orderRefPrefix ? { order_ref_prefix: s.orderRefPrefix } : {}),
      low_stock_threshold: s.lowStockThreshold,
      announcement: s.announcement ?? null,
      coupons_enabled: s.couponsEnabled,
      theme: { primary: s.themePrimary.toLowerCase(), accent: s.themeAccent.toLowerCase() },
    })
    .eq('id', 1);
  if (error) return { ok: false, message: mapDbError(error).message };
  revalidatePath('/', 'layout');
  updateTag(CATALOG_TAG);
  return { ok: true, message: 'Settings saved.' };
}

const LOGO_PATH = /^brand\/[0-9a-f-]{36}\.(png|jpg|jpeg|webp|avif)$/;

export async function setLogo(path: string | null): Promise<ActionState> {
  const { supabase } = await requirePermission('store_settings');
  if (path !== null && !LOGO_PATH.test(path)) return { ok: false, message: 'Invalid logo file.' };
  const { data: current } = await supabase.from('store_settings').select('logo_path').eq('id', 1).single<{ logo_path: string | null }>();
  const { error } = await supabase.from('store_settings').update({ logo_path: path }).eq('id', 1);
  if (error) return { ok: false, message: mapDbError(error).message };
  if (current?.logo_path && current.logo_path !== path) await supabase.storage.from(IMAGE_BUCKET).remove([current.logo_path]);
  revalidatePath('/', 'layout');
  updateTag(CATALOG_TAG);
  return { ok: true, message: path ? 'Logo updated.' : 'Logo removed.' };
}

export async function saveZone(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requirePermission('store_settings');
  const parsed = zoneSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, message: 'Please fix the highlighted fields.', fieldErrors: fieldErrors(parsed.error) };
  const z0 = parsed.data;
  const row = {
    name: z0.name,
    charge: z0.charge,
    free_over: z0.freeOver ?? null,
    eta_text: z0.etaText ?? null,
    sort_order: z0.sortOrder,
    is_active: z0.isActive,
  };
  const { error } = z0.id
    ? await supabase.from('delivery_zones').update(row).eq('id', z0.id)
    : await supabase.from('delivery_zones').insert(row);
  if (error) return { ok: false, message: mapDbError(error).message };
  revalidatePath('/', 'layout');
  updateTag(CATALOG_TAG);
  return { ok: true, message: z0.id ? 'Delivery area saved.' : 'Delivery area added.' };
}

export async function deleteZone(formData: FormData): Promise<void> {
  const { supabase } = await requirePermission('store_settings');
  const id = z.uuid().parse(formData.get('id'));
  // Past orders keep the zone name they were placed with (orders.zone_name).
  await supabase.from('delivery_zones').delete().eq('id', id);
  revalidatePath('/', 'layout');
  updateTag(CATALOG_TAG);
}

// ------------------------------------------------------------- courier

/** Secret inputs: empty → keep the saved value; "Remove" ticked → clear it. */
function secretValue(fd: FormData, name: string, value: string | undefined) {
  if (fd.get(`clear_${name}`) === 'on') return '__clear__';
  return value ?? '';
}

export async function saveCourierSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requirePermission('courier_settings');
  const parsed = courierSettingsSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, message: 'Please fix the highlighted fields.', fieldErrors: fieldErrors(parsed.error) };
  const c = parsed.data;
  const { error } = await supabase.rpc('save_courier_settings', {
    p: {
      default_courier: c.defaultCourier ?? '',
      steadfast_base_url: c.steadfastBaseUrl ?? '',
      steadfast_api_key: secretValue(formData, 'steadfastApiKey', c.steadfastApiKey),
      steadfast_secret_key: secretValue(formData, 'steadfastSecretKey', c.steadfastSecretKey),
      steadfast_webhook_token: secretValue(formData, 'steadfastWebhookToken', c.steadfastWebhookToken),
      pathao_sandbox: c.pathaoSandbox,
      pathao_client_id: secretValue(formData, 'pathaoClientId', c.pathaoClientId),
      pathao_client_secret: secretValue(formData, 'pathaoClientSecret', c.pathaoClientSecret),
      pathao_username: c.pathaoUsername ?? '',
      pathao_password: secretValue(formData, 'pathaoPassword', c.pathaoPassword),
      pathao_store_id: c.pathaoStoreId ?? '',
      pathao_webhook_secret: secretValue(formData, 'pathaoWebhookSecret', c.pathaoWebhookSecret),
      pathao_integration_secret: secretValue(formData, 'pathaoIntegrationSecret', c.pathaoIntegrationSecret),
      default_weight_kg: c.defaultWeightKg,
      parcel_note: c.parcelNote ?? '',
      auto_sync: c.autoSync,
    },
  });
  if (error) return { ok: false, message: mapDbError(error).message };
  revalidatePath('/admin/settings');
  revalidatePath('/admin/orders');
  return { ok: true, message: 'Courier settings saved.' };
}

// ----------------------------------------------------------- marketing

/**
 * Facebook settings. Forgiving with what people paste (spaces in the Pixel ID,
 * long tokens, a lowercase test code), strict about what is stored, and it
 * reads everything back so "saved" always means the database has it.
 */
export async function saveMarketingSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission('marketing');
  const raw = formToObject(formData);
  const pixel = String(raw.fbPixelId ?? '').replace(/\D/g, '');
  const token = String(raw.capiToken ?? '').replace(/\s/g, '');
  const testCode = String(raw.capiTestCode ?? '').trim().toUpperCase();
  const graph = String(raw.graphVersion ?? '').trim() || 'v26.0';
  const capiEnabled = raw.capiEnabled === 'on' || raw.capiEnabled === 'true';
  const clearToken = formData.get('clear_capiToken') === 'on';

  const errors: Record<string, string> = {};
  if (pixel && !/^\d{6,20}$/.test(pixel)) errors.fbPixelId = 'The Pixel (Dataset) ID is a number of 6–20 digits.';
  if (token && !/^[A-Za-z0-9_-]{20,1000}$/.test(token)) errors.capiToken = 'That does not look like a Facebook access token (it starts with EAA…). Paste the whole token.';
  if (testCode && !/^[A-Z0-9]{1,40}$/.test(testCode)) errors.capiTestCode = 'Letters and numbers only, like TEST12345.';
  if (!/^v\d{1,3}\.\d$/.test(graph)) errors.graphVersion = 'Like v26.0';
  if (Object.keys(errors).length) return { ok: false, message: Object.values(errors)[0]!, fieldErrors: errors };

  const admin = createAdminClient();
  const { data: before } = await admin.from('marketing_settings').select('capi_token').eq('id', 1).maybeSingle<{ capi_token: string | null }>();
  const nextToken = clearToken ? null : token || before?.capi_token || null;
  if (capiEnabled && !pixel) return { ok: false, message: 'Add the Pixel ID to use the Conversions API.', fieldErrors: { fbPixelId: 'Required for the Conversions API' } };
  if (capiEnabled && !nextToken) return { ok: false, message: 'Add the access token to use the Conversions API.', fieldErrors: { capiToken: 'Required for the Conversions API' } };

  const [a, b] = await Promise.all([
    admin.from('store_settings').update({ fb_pixel_id: pixel || null }).eq('id', 1),
    admin.from('marketing_settings').update({ capi_enabled: capiEnabled, capi_token: nextToken, capi_test_code: testCode || null, graph_version: graph }).eq('id', 1),
  ]);
  if (a.error || b.error) {
    console.error('[admin] facebook settings', a.error ?? b.error);
    return { ok: false, message: 'Could not save the Facebook settings. Please try again.' };
  }

  // Read back: report exactly what is stored now.
  const [{ data: s }, { data: m }] = await Promise.all([
    admin.from('store_settings').select('fb_pixel_id').eq('id', 1).single<{ fb_pixel_id: string | null }>(),
    admin.from('marketing_settings').select('capi_enabled, capi_token, capi_test_code').eq('id', 1).single<{ capi_enabled: boolean; capi_token: string | null; capi_test_code: string | null }>(),
  ]);
  if ((s?.fb_pixel_id ?? '') !== pixel || (m?.capi_token ?? null) !== nextToken || (m?.capi_test_code ?? '') !== testCode) {
    return { ok: false, message: 'The settings did not stick. Please reload the page and try again.' };
  }
  revalidatePath('/', 'layout');
  updateTag(CATALOG_TAG);
  revalidatePath('/admin/settings');
  const parts = [
    s?.fb_pixel_id ? `Pixel ID ${s.fb_pixel_id} ✓` : 'Pixel off',
    m?.capi_token ? `Access token ✓ (ends …${m.capi_token.slice(-4)})` : 'No access token',
    m?.capi_test_code ? `Test code ${m.capi_test_code} ✓` : null,
    m?.capi_enabled ? 'Conversions API ON' : 'Conversions API off',
  ].filter(Boolean);
  return { ok: true, message: `Saved — ${parts.join(' · ')}` };
}

// ----------------------------------------------------- staff and roles

/**
 * Super admin only. New staff: the login is created in Supabase Auth with
 * the service role, then save_staff() — called as the super admin, so the
 * database checks is_owner() itself — gives it a profile and role.
 */
export async function saveStaff(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user } = await requireSuperAdmin();
  const parsed = staffSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, message: 'Please fix the highlighted fields.', fieldErrors: fieldErrors(parsed.error) };
  const s = parsed.data;
  const admin = createAdminClient();

  let userId = s.userId;
  let created = false;
  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({ email: s.email!, password: s.password!, email_confirm: true, user_metadata: { full_name: s.fullName } });
    if (error || !data.user) {
      const taken = /already|exists|registered/i.test(error?.message ?? '');
      return { ok: false, message: taken ? 'That email already has an account.' : 'Could not create the login. Try again.', fieldErrors: taken ? { email: 'Already registered' } : undefined };
    }
    userId = data.user.id;
    created = true;
  }

  const { error } = await supabase.rpc('save_staff', { p_user_id: userId, p_full_name: s.fullName, p_role: s.role, p_active: s.isActive });
  if (error) {
    if (created) await admin.auth.admin.deleteUser(userId);
    return { ok: false, message: mapDbError(error).message };
  }
  if (!created && s.password) {
    if (userId === user.id) return { ok: false, message: 'Change your own password under My account.' };
    const { error: pwErr } = await admin.auth.admin.updateUserById(userId, { password: s.password });
    if (pwErr) return { ok: false, message: 'Saved, but the new password was not accepted.' };
  }
  revalidatePath('/admin/settings');
  return { ok: true, message: created ? `${s.fullName} can now sign in with ${s.email}.` : 'Staff member saved.' };
}

export async function saveRolePermissions(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireSuperAdmin();
  const role = formData.get('role');
  if (role !== 'manager' && role !== 'support') return { ok: false, message: 'Invalid role.' };
  const perms = formData.getAll('permissions').filter(isPermission);
  const ordered = PERMISSIONS.filter((p) => perms.includes(p));
  const { error } = await supabase.rpc('set_role_permissions', { p_role: role, p_permissions: ordered });
  if (error) return { ok: false, message: mapDbError(error).message };
  revalidatePath('/admin', 'layout');
  return { ok: true, message: 'Permissions saved. They apply on the next page load.' };
}

/** "Test connection": sends one PageView through the Conversions API with the saved Pixel ID and token. */
export async function testFacebookConnection(): Promise<ActionState> {
  await requirePermission('marketing');
  const admin = createAdminClient();
  const [{ data: s }, { data: m }] = await Promise.all([
    admin.from('store_settings').select('fb_pixel_id').eq('id', 1).single<{ fb_pixel_id: string | null }>(),
    admin.from('marketing_settings').select('capi_token, capi_test_code, graph_version').eq('id', 1).single<{ capi_token: string | null; capi_test_code: string | null; graph_version: string }>(),
  ]);
  if (!s?.fb_pixel_id) return { ok: false, message: 'Save the Pixel ID first.' };
  if (!m?.capi_token) return { ok: false, message: 'Save the access token first.' };
  try {
    const res = await fetch(`https://graph.facebook.com/${m.graph_version}/${s.fb_pixel_id}/events?access_token=${encodeURIComponent(m.capi_token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [{ event_name: 'PageView', event_time: Math.floor(Date.now() / 1000), action_source: 'website', event_source_url: process.env.NEXT_PUBLIC_SITE_URL ?? undefined, user_data: { client_user_agent: 'Sidraa admin connection test' } }],
        ...(m.capi_test_code ? { test_event_code: m.capi_test_code } : {}),
      }),
      signal: AbortSignal.timeout(15_000),
      cache: 'no-store',
    });
    const body = (await res.json().catch(() => null)) as { events_received?: number; error?: { message?: string } } | null;
    if (res.ok && body?.events_received) {
      return { ok: true, message: m.capi_test_code ? `Connected ✓ Facebook received the test event — see it under Events Manager → Test events (${m.capi_test_code}).` : 'Connected ✓ Facebook received the test event.' };
    }
    return { ok: false, message: `Facebook said: ${body?.error?.message ?? `HTTP ${res.status}`}` };
  } catch {
    return { ok: false, message: 'Could not reach Facebook. Try again in a minute.' };
  }
}
