'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth';
import { CATALOG_TAG } from '@/lib/catalog';
import { collectionFilter, ruleSchema, type Rule } from '@/lib/collections';
import { mapDbError } from '@/lib/db-errors';
import { SLUG_RE } from '@/lib/slug';
import { countTags } from '@/lib/tags';
import type { ActionState } from '@/lib/types';

const collectionSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, 'Name is required').max(80),
  slug: z.string().trim().toLowerCase().regex(SLUG_RE, 'Use lowercase letters, numbers and dashes').max(80),
  description: z.string().trim().max(2000).transform((v) => v || null),
  isPublic: z.boolean(),
  match: z.enum(['any', 'all']),
  rules: z.array(ruleSchema).max(20, 'At most 20 rules'),
  productIds: z.array(z.uuid()).max(200, 'At most 200 picked products'),
  sortOrder: z.number().int().min(-1000).max(1000),
});
export type CollectionInput = z.input<typeof collectionSchema>;

function refresh() {
  revalidatePath('/', 'layout');
  updateTag(CATALOG_TAG);
}

type Db = Awaited<ReturnType<typeof requirePermission>>['supabase'];

/** The filter for rules as typed in the form (categories with their children, every tag spelling). */
async function filterFor(supabase: Db, c: { match: 'any' | 'all'; rules: Rule[]; productIds: string[] }) {
  const [{ data: cats }, { data: tagRows }] = await Promise.all([
    supabase.from('categories').select('id, parent_id'),
    supabase.from('products').select('tags').neq('tags', '{}').limit(5000),
  ]);
  const categories = (cats ?? []) as { id: string; parent_id: string | null }[];
  const tags = countTags((tagRows ?? []) as { tags: string[] | null }[]);
  // countTags keeps one spelling; staff typed tags exist as typed, so offer that too.
  const spellings = (tag: string) => [...new Set([tag, ...tags.filter((t) => t.tag.toLowerCase() === tag.toLowerCase()).map((t) => t.tag)])];
  return collectionFilter({ match: c.match, rules: c.rules, product_ids: c.productIds }, (id) => [id, ...categories.filter((x) => x.parent_id === id).map((x) => x.id)], spellings);
}

export type PreviewProduct = { id: string; name: string; sku: string; status: string; image: string | null };

/** Which products the rules catch right now (shown live while editing). */
export async function previewCollection(input: unknown): Promise<{ ok: boolean; total: number; published: number; products: PreviewProduct[]; message?: string }> {
  const { supabase } = await requirePermission('catalog');
  const parsed = collectionSchema.pick({ match: true, rules: true, productIds: true }).safeParse(input);
  if (!parsed.success) return { ok: false, total: 0, published: 0, products: [], message: parsed.error.issues[0]?.message };
  const filter = await filterFor(supabase, parsed.data);
  if (!filter) return { ok: true, total: 0, published: 0, products: [] };
  const [list, pub] = await Promise.all([
    supabase.from('products').select('id, name, sku, status, images:product_images(storage_path, sort_order)', { count: 'exact' }).neq('status', 'archived').or(filter).order('created_at', { ascending: false }).limit(24),
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'published').or(filter),
  ]);
  if (list.error) return { ok: false, total: 0, published: 0, products: [], message: 'Could not check these rules.' };
  const products = ((list.data ?? []) as { id: string; name: string; sku: string; status: string; images: { storage_path: string; sort_order: number }[] }[]).map((p) => ({
    id: p.id, name: p.name, sku: p.sku, status: p.status, image: [...p.images].sort((a, b) => a.sort_order - b.sort_order)[0]?.storage_path ?? null,
  }));
  return { ok: true, total: list.count ?? products.length, published: pub.count ?? 0, products };
}

export async function saveCollection(input: CollectionInput): Promise<ActionState> {
  const { supabase } = await requirePermission('catalog');
  const parsed = collectionSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, message: issue?.message ?? 'Please check the form.', fieldErrors: issue?.path[0] ? { [String(issue.path[0])]: issue.message } : undefined };
  }
  const c = parsed.data;
  const row = { name: c.name, slug: c.slug, description: c.description, is_public: c.isPublic, match: c.match, rules: c.rules, product_ids: [...new Set(c.productIds)], sort_order: c.sortOrder };
  const { data, error } = c.id
    ? await supabase.from('collections').update(row).eq('id', c.id).select('id').single()
    : await supabase.from('collections').insert(row).select('id').single();
  if (error) {
    if (error.code === '23505') return { ok: false, message: 'Another collection already uses this web address.', fieldErrors: { slug: 'Already used' } };
    const mapped = mapDbError(error);
    if (mapped.code === 'UNKNOWN') console.error('[admin] save collection', error);
    return { ok: false, message: mapped.message };
  }
  refresh();
  revalidatePath('/admin/collections');
  if (!c.id) redirect(`/admin/collections?created=${data.id}`);
  return { ok: true, message: 'Collection saved.' };
}

export async function deleteCollection(id: string): Promise<ActionState> {
  const { supabase } = await requirePermission('catalog');
  if (!z.uuid().safeParse(id).success) return { ok: false, message: 'Not found.' };
  const { error, count } = await supabase.from('collections').delete({ count: 'exact' }).eq('id', id);
  if (error || !count) return { ok: false, message: 'Could not delete. Please try again.' };
  refresh();
  revalidatePath('/admin/collections');
  return { ok: true, message: 'Collection deleted.' };
}
