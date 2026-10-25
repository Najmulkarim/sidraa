'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth';
import { CATALOG_TAG } from '@/lib/catalog';
import { mapDbError } from '@/lib/db-errors';
import { SECTION_TYPES, SETTINGS_SCHEMA, THEMES, sectionInputSchema, type SectionType } from '@/lib/home-sections';
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
    // On/off belongs to the switch in the list only, so an open editor can never undo it.
    .update({ title: base.data.title, subtitle: base.data.subtitle, settings: settings.data })
    .eq('id', base.data.id);
  if (error) return fail(error, 'save');
  refresh();
  return { ok: true, message: 'Saved. The home page shows it now.' };
}

/** Shows or hides a section, then reads it back: success only when the database really has the new value. */
export async function setHomeSectionEnabled(id: string, enabled: boolean): Promise<ActionState & { enabled?: boolean }> {
  const { supabase } = await requirePermission('store_settings');
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success || typeof enabled !== 'boolean') return { ok: false, message: 'Invalid section.' };
  const { data, error } = await supabase.from('home_sections').update({ enabled }).eq('id', parsed.data).select('enabled, title, type').maybeSingle<{ enabled: boolean; title: string | null; type: string }>();
  if (error) return fail(error, 'toggle');
  if (!data) return { ok: false, message: 'That section was not found — reload the page and try again.' };
  if (data.enabled !== enabled) return { ok: false, message: 'The change did not stick. Please try again.', enabled: data.enabled };
  refresh();
  const name = data.title || 'Section';
  return { ok: true, enabled: data.enabled, message: enabled ? `“${name}” is now ON — it shows on the home page.` : `“${name}” is now OFF — hidden from the home page.` };
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

/** Makes a theme the live home page (one click in Admin › Homepage). */
export async function activateTheme(theme: string): Promise<ActionState> {
  const { supabase } = await requirePermission('store_settings');
  const parsed = z.enum(THEMES).safeParse(theme);
  if (!parsed.success) return { ok: false, message: 'Unknown theme.' };
  // A deleted theme goes live only after it is restored.
  const { data: s } = await supabase.from('store_settings').select('hidden_themes').eq('id', 1).maybeSingle<{ hidden_themes: string[] | null }>();
  if (s?.hidden_themes?.includes(parsed.data)) return { ok: false, message: 'This theme is deleted. Restore it first.' };
  const { error } = await supabase.from('store_settings').update({ home_theme: parsed.data }).eq('id', 1);
  if (error) return fail(error, 'activate theme');
  refresh();
  return { ok: true, message: 'Done — this theme is now your live home page.' };
}

/** Removes a theme from the Homepage list (hide = true) or brings it back. Its sections are kept; the live theme cannot be removed. */
export async function setThemeHidden(theme: string, hide: boolean): Promise<ActionState> {
  const { supabase } = await requirePermission('store_settings');
  const parsed = z.enum(THEMES).safeParse(theme);
  if (!parsed.success) return { ok: false, message: 'Unknown theme.' };
  const { data: s, error: readError } = await supabase.from('store_settings').select('home_theme, hidden_themes').eq('id', 1).single<{ home_theme: string; hidden_themes: string[] | null }>();
  if (readError || !s) return { ok: false, message: 'Run the latest database update (0029) in Supabase first.' };
  if (hide && s.home_theme === parsed.data) return { ok: false, message: 'This theme is live. Activate another theme first, then delete this one.' };
  const current = (s.hidden_themes ?? []).filter((t) => t !== parsed.data);
  const next = hide ? [...current, parsed.data] : current;
  const { error } = await supabase.from('store_settings').update({ hidden_themes: next }).eq('id', 1);
  if (error) return fail(error, 'hide theme');
  refresh();
  return { ok: true, message: hide ? 'Theme deleted from your list. You can restore it any time under “Deleted themes”.' : 'Theme restored — it is back in your list, with all its sections.' };
}

/** Adds a section at the bottom of a theme, switched off so it can be filled in first. */
export async function addHomeSection(type: string, theme: string): Promise<ActionState & { id?: string }> {
  const { supabase } = await requirePermission('store_settings');
  const parsed = z.enum(SECTION_TYPES).safeParse(type);
  const th = z.enum(THEMES).safeParse(theme);
  if (!parsed.success || !th.success) return { ok: false, message: 'Choose a section type.' };
  const { data: last } = await supabase.from('home_sections').select('sort_order').eq('theme', th.data).order('sort_order', { ascending: false }).limit(1).maybeSingle<{ sort_order: number }>();
  const { data, error } = await supabase
    .from('home_sections')
    .insert({ theme: th.data, type: parsed.data, enabled: false, sort_order: (last?.sort_order ?? 0) + 10, settings: SETTINGS_SCHEMA[parsed.data].parse({}) })
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
