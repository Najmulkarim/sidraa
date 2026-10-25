'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth';
import { CATALOG_TAG } from '@/lib/catalog';
import { mapDbError } from '@/lib/db-errors';
import { SECTION_TYPES, SETTINGS_SCHEMA, sectionInputSchema, type SectionType } from '@/lib/home-sections';
import type { ActionState } from '@/lib/types';

/** Home page builder. Every change refreshes the cached home page at once. */
function refresh() {
  revalidatePath('/', 'layout');
  updateTag(CATALOG_TAG);
  revalidatePath('/admin/homepage');
}

function fail(error: Parameters<typeof mapDbError>[0], context: string): ActionState {
  const mapped = mapDbError(error);
  if (mapped.code === 'UNKNOWN') console.error(`[admin] home ${context}`, error);
  return { ok: false, message: mapped.message };
}

export async function saveHomeSection(input: { id: string; title: string; subtitle: string; enabled: boolean; settings: unknown }): Promise<ActionState> {
  const { supabase } = await requirePermission('store_settings');
  const base = sectionInputSchema.safeParse(input);
  if (!base.success) return { ok: false, message: 'Please check the heading and text.' };
  const { data: row } = await supabase.from('home_sections').select('type').eq('id', base.data.id).maybeSingle<{ type: SectionType }>();
  if (!row || !(SECTION_TYPES as readonly string[]).includes(row.type)) return { ok: false, message: 'Section not found. Reload the page.' };
  const settings = SETTINGS_SCHEMA[row.type].safeParse(input.settings ?? {});
  if (!settings.success) {
    const first = settings.error.issues[0];
    return { ok: false, message: `${first?.path.join(' › ') || 'Settings'}: ${first?.message ?? 'invalid'}` };
  }
  const { error } = await supabase
    .from('home_sections')
    .update({ title: base.data.title, subtitle: base.data.subtitle, enabled: base.data.enabled, settings: settings.data })
    .eq('id', base.data.id);
  if (error) return fail(error, 'save');
  refresh();
  return { ok: true, message: 'Saved. The home page shows it now.' };
}

export async function setHomeSectionEnabled(id: string, enabled: boolean): Promise<ActionState> {
  const { supabase } = await requirePermission('store_settings');
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return { ok: false, message: 'Invalid section.' };
  const { error } = await supabase.from('home_sections').update({ enabled }).eq('id', parsed.data);
  if (error) return fail(error, 'toggle');
  refresh();
  return { ok: true };
}

/** Saves a new order: the ids from top to bottom. */
export async function reorderHomeSections(ids: string[]): Promise<ActionState> {
  const { supabase } = await requirePermission('store_settings');
  const parsed = z.array(z.uuid()).max(100).safeParse(ids);
  if (!parsed.success) return { ok: false, message: 'Invalid order.' };
  const results = await Promise.all(parsed.data.map((id, i) => supabase.from('home_sections').update({ sort_order: (i + 1) * 10 }).eq('id', id)));
  const error = results.find((r) => r.error)?.error;
  if (error) return fail(error, 'reorder');
  refresh();
  return { ok: true };
}

/** Adds a section at the bottom, switched off so it can be filled in first. */
export async function addHomeSection(type: string): Promise<ActionState & { id?: string }> {
  const { supabase } = await requirePermission('store_settings');
  const parsed = z.enum(SECTION_TYPES).safeParse(type);
  if (!parsed.success) return { ok: false, message: 'Choose a section type.' };
  const { data: last } = await supabase.from('home_sections').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle<{ sort_order: number }>();
  const { data, error } = await supabase
    .from('home_sections')
    .insert({ type: parsed.data, enabled: false, sort_order: (last?.sort_order ?? 0) + 10, settings: SETTINGS_SCHEMA[parsed.data].parse({}) })
    .select('id')
    .single<{ id: string }>();
  if (error || !data) return fail(error, 'add');
  refresh();
  return { ok: true, message: 'Section added at the bottom (switched off). Fill it in, then switch it on.', id: data.id };
}

export async function deleteHomeSection(id: string): Promise<ActionState> {
  const { supabase } = await requirePermission('store_settings');
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return { ok: false, message: 'Invalid section.' };
  const { error } = await supabase.from('home_sections').delete().eq('id', parsed.data);
  if (error) return fail(error, 'delete');
  refresh();
  return { ok: true, message: 'Section deleted.' };
}
