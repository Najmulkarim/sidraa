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
import { courierSettingsSchema, fieldErrors, formToObject, marketingSettingsSchema, settingsSchema, staffSchema, zoneSchema } from '@/lib/validation';

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
      order_ref_prefix: s.orderRefPrefix,
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

export async function saveMarketingSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requirePermission('marketing');
  const parsed = marketingSettingsSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, message: 'Please fix the highlighted fields.', fieldErrors: fieldErrors(parsed.error) };
  const m = parsed.data;
  if (m.capiEnabled && !m.fbPixelId) return { ok: false, message: 'Add the Pixel ID to use the Conversions API.', fieldErrors: { fbPixelId: 'Required for the Conversions API' } };
  const { error } = await supabase.rpc('save_marketing_settings', {
    p: {
      fb_pixel_id: m.fbPixelId ?? '',
      capi_enabled: m.capiEnabled,
      capi_token: secretValue(formData, 'capiToken', m.capiToken),
      capi_test_code: m.capiTestCode ?? '',
      graph_version: m.graphVersion,
    },
  });
  if (error) {
    const mapped = mapDbError(error);
    return { ok: false, message: mapped.message, fieldErrors: mapped.field === 'fb_pixel_id' ? { fbPixelId: mapped.message } : undefined };
  }
  revalidatePath('/', 'layout');
  updateTag(CATALOG_TAG);
  return { ok: true, message: 'Facebook settings saved.' };
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
