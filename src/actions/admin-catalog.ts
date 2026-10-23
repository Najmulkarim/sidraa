'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth';
import { mapDbError } from '@/lib/db-errors';
import { IMAGE_BUCKET } from '@/lib/env';
import type { ActionState } from '@/lib/types';
import { adjustStockSchema, categorySchema, fieldErrors, formToObject, imageMetaSchema, productSchema } from '@/lib/validation';

/** Every catalogue change refreshes the cached storefront pages. */
function refreshStore() {
  revalidatePath('/', 'layout');
}

function fail(error: Parameters<typeof mapDbError>[0], context: string): ActionState {
  const mapped = mapDbError(error);
  if (mapped.code === 'UNKNOWN') console.error(`[admin] ${context}`, error);
  return { ok: false, message: mapped.message };
}

// --------------------------------------------------------------- products

export async function saveProduct(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requirePermission('catalog');
  const parsed = productSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, message: 'Please fix the highlighted fields.', fieldErrors: fieldErrors(parsed.error) };
  const p = parsed.data;

  const row = {
    name: p.name,
    slug: p.slug,
    category_id: p.categoryId ?? null,
    description: p.description ?? null,
    base_price: p.basePrice,
    compare_at_price: p.compareAtPrice ?? null,
    status: p.status,
    is_featured: p.isFeatured,
    seo_title: p.seoTitle ?? null,
    seo_description: p.seoDescription ?? null,
    color_label: p.colorLabel,
    size_label: p.sizeLabel,
    option3_label: p.option3Label ?? null,
  };

  let productId = p.id;
  if (productId) {
    const { error } = await supabase.from('products').update(row).eq('id', productId);
    if (error) return fail(error, 'update product');
  } else {
    const insertRow: typeof row & { id?: string } = p.newId ? { ...row, id: p.newId } : row;
    const { data, error } = await supabase
      .from('products')
      .insert(insertRow)
      .select('id')
      .single<{ id: string }>();
    if (error || !data) return fail(error, 'insert product');
    productId = data.id;
    // Photos uploaded on the New product page (before the product existed).
    const photos = p.photos.filter((ph) => ph.path.startsWith(`products/${productId}/`));
    if (photos.length) {
      const { error: imgError } = await supabase
        .from('product_images')
        .insert(photos.map((ph, i) => ({ product_id: productId, storage_path: ph.path, alt: ph.alt || p.name, sort_order: i })));
      if (imgError) console.error('[admin] new product photos', imgError);
    }
  }

  // Variants: update the ones that exist, insert new ones (stock 0, then
  // opening stock through adjust_stock so it is logged), and remove the
  // ones taken out of the form — or deactivate them if orders use them.
  const { data: existing, error: listError } = await supabase
    .from('product_variants')
    .select('id, sku')
    .eq('product_id', productId);
  if (listError) return fail(listError, 'list variants');
  const existingIds = new Set((existing ?? []).map((v: { id: string }) => v.id));
  const keptIds = new Set(p.variants.filter((v) => v.id).map((v) => v.id as string));
  const notes: string[] = [];

  // A brand-new product already exists at this point; if a variant fails,
  // continue on its edit page rather than letting a resubmit duplicate it.
  const bail = (message: string): ActionState => {
    if (!p.id) redirect(`/admin/products/${productId}?${new URLSearchParams({ created: '1', note: message.slice(0, 500) })}`);
    return { ok: false, message };
  };

  const { data: photoRows } = await supabase.from('product_images').select('storage_path').eq('product_id', productId);
  const photos = new Set(((photoRows ?? []) as { storage_path: string }[]).map((r) => r.storage_path));

  for (const v of p.variants) {
    if (v.id && !existingIds.has(v.id)) return { ok: false, message: 'A variant in the form does not belong to this product. Reload and try again.' };
  }

  for (const old of existing ?? []) {
    if (keptIds.has(old.id)) continue;
    const { error, count } = await supabase.from('product_variants').delete({ count: 'exact' }).eq('id', old.id);
    if (error || count === 0) {
      // RLS refuses to delete a variant that appears in orders.
      await supabase.from('product_variants').update({ is_active: false }).eq('id', old.id);
      notes.push(`${old.sku} has orders, so it was hidden instead of deleted.`);
    }
  }

  for (const v of p.variants) {
    // Variation photos must be this product's own photos (the database checks too).
    const imagePath = v.imagePath && photos.has(v.imagePath) ? v.imagePath : null;
    const fields = { sku: v.sku, size: v.size, color: v.color, option3: v.option3, image_path: imagePath, price: v.price, is_active: v.isActive };
    if (v.id) {
      const { error } = await supabase.from('product_variants').update(fields).eq('id', v.id);
      if (error) return bail(`${v.sku}: ${fail(error, 'update variant').message}`);
    } else {
      const { data, error } = await supabase
        .from('product_variants')
        .insert({ ...fields, product_id: productId, stock: 0 })
        .select('id')
        .single<{ id: string }>();
      if (error || !data) return bail(`${v.sku}: ${fail(error, 'insert variant').message}`);
      if (v.openingStock > 0) {
        const { error: stockError } = await supabase.rpc('adjust_stock', {
          p_variant_id: data.id,
          p_change: v.openingStock,
          p_reason: 'restock',
          p_note: 'Opening stock',
        });
        if (stockError) notes.push(`${v.sku}: opening stock not saved (${mapDbError(stockError).message})`);
      }
    }
  }

  refreshStore();
  // Redirect so the form remounts with the saved variant ids.
  const qs = new URLSearchParams(p.id ? { saved: '1' } : { created: '1' });
  if (notes.length) qs.set('note', notes.join(' ').slice(0, 500));
  redirect(`/admin/products/${productId}?${qs.toString()}`);
}

export async function deleteProduct(formData: FormData): Promise<void> {
  const { supabase } = await requirePermission('catalog');
  const id = z.uuid().parse(formData.get('id'));
  const { data: images } = await supabase.from('product_images').select('storage_path').eq('product_id', id);
  const { error, count } = await supabase.from('products').delete({ count: 'exact' }).eq('id', id);
  if (error || count === 0) redirect(`/admin/products/${id}?error=delete`);
  const paths = (images ?? []).map((i: { storage_path: string }) => i.storage_path);
  if (paths.length) await supabase.storage.from(IMAGE_BUCKET).remove(paths);
  refreshStore();
  redirect('/admin/products?deleted=1');
}

// ----------------------------------------------------------------- images

/** Called after the browser has uploaded the file to Storage. */
export async function addProductImage(input: { productId: string; storagePath: string; alt?: string }): Promise<ActionState> {
  const { supabase } = await requirePermission('catalog');
  const parsed = imageMetaSchema.safeParse(input);
  if (!parsed.success || !parsed.data.storagePath.startsWith(`products/${parsed.data.productId}/`)) {
    return { ok: false, message: 'Invalid image.' };
  }
  const { data: last } = await supabase
    .from('product_images')
    .select('sort_order')
    .eq('product_id', parsed.data.productId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle<{ sort_order: number }>();
  const { error } = await supabase.from('product_images').insert({
    product_id: parsed.data.productId,
    storage_path: parsed.data.storagePath,
    alt: parsed.data.alt ?? null,
    sort_order: (last?.sort_order ?? -1) + 1,
  });
  if (error) {
    await supabase.storage.from(IMAGE_BUCKET).remove([parsed.data.storagePath]);
    return fail(error, 'add image');
  }
  refreshStore();
  revalidatePath(`/admin/products/${parsed.data.productId}`);
  return { ok: true, message: 'Image added.' };
}

export async function updateImageAlt(imageId: string, alt: string): Promise<ActionState> {
  const { supabase } = await requirePermission('catalog');
  const id = z.uuid().safeParse(imageId);
  const text = z.string().trim().max(200).safeParse(alt);
  if (!id.success || !text.success) return { ok: false, message: 'Invalid input.' };
  const { error } = await supabase.from('product_images').update({ alt: text.data || null }).eq('id', id.data);
  if (error) return fail(error, 'image alt');
  refreshStore();
  return { ok: true, message: 'Saved.' };
}

export async function moveImage(imageId: string, direction: 'up' | 'down'): Promise<ActionState> {
  const { supabase } = await requirePermission('catalog');
  const id = z.uuid().safeParse(imageId);
  if (!id.success) return { ok: false, message: 'Invalid image.' };
  const { data: img } = await supabase.from('product_images').select('product_id').eq('id', id.data).single<{ product_id: string }>();
  if (!img) return { ok: false, message: 'Image not found.' };
  const { data: all } = await supabase
    .from('product_images')
    .select('id, product_id, storage_path, alt, sort_order')
    .eq('product_id', img.product_id)
    .order('sort_order');
  const list = (all ?? []) as { id: string; product_id: string; storage_path: string; alt: string | null; sort_order: number }[];
  const i = list.findIndex((x) => x.id === id.data);
  const j = direction === 'up' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return { ok: true };
  const a = list[i]!;
  const b = list[j]!;
  // One upsert statement; the unique (product_id, sort_order) constraint
  // is deferrable, so swapping two positions does not collide.
  const { error } = await supabase.from('product_images').upsert([
    { ...a, sort_order: b.sort_order },
    { ...b, sort_order: a.sort_order },
  ]);
  if (error) return fail(error, 'move image');
  refreshStore();
  revalidatePath(`/admin/products/${img.product_id}`);
  return { ok: true };
}

export async function deleteImage(imageId: string): Promise<ActionState> {
  const { supabase } = await requirePermission('catalog');
  const id = z.uuid().safeParse(imageId);
  if (!id.success) return { ok: false, message: 'Invalid image.' };
  const { data: img } = await supabase
    .from('product_images')
    .select('product_id, storage_path')
    .eq('id', id.data)
    .single<{ product_id: string; storage_path: string }>();
  if (!img) return { ok: false, message: 'Image not found.' };
  const { error } = await supabase.from('product_images').delete().eq('id', id.data);
  if (error) return fail(error, 'delete image');
  await supabase.storage.from(IMAGE_BUCKET).remove([img.storage_path]);
  refreshStore();
  revalidatePath(`/admin/products/${img.product_id}`);
  return { ok: true, message: 'Image removed.' };
}

// ------------------------------------------------------------- categories

export async function saveCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requirePermission('catalog');
  const parsed = categorySchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, message: 'Please fix the highlighted fields.', fieldErrors: fieldErrors(parsed.error) };
  const c = parsed.data;
  const row = { name: c.name, slug: c.slug, description: c.description ?? null, sort_order: c.sortOrder, is_public: c.isPublic };
  const { error } = c.id
    ? await supabase.from('categories').update(row).eq('id', c.id)
    : await supabase.from('categories').insert(row);
  if (error) return fail(error, 'save category');
  refreshStore();
  revalidatePath('/admin/categories');
  return { ok: true, message: c.id ? 'Category saved.' : 'Category added.' };
}

export async function deleteCategory(formData: FormData): Promise<void> {
  const { supabase } = await requirePermission('catalog');
  const id = z.uuid().parse(formData.get('id'));
  // Products in this category keep existing; their category becomes empty.
  await supabase.from('categories').delete().eq('id', id);
  refreshStore();
  revalidatePath('/admin/categories');
}

// -------------------------------------------------------------- inventory

export async function adjustStock(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requirePermission('inventory');
  const parsed = adjustStockSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, message: 'Please fix the highlighted fields.', fieldErrors: fieldErrors(parsed.error) };
  const { data, error } = await supabase.rpc('adjust_stock', {
    p_variant_id: parsed.data.variantId,
    p_change: parsed.data.change,
    p_reason: parsed.data.reason,
    p_note: parsed.data.note ?? null,
  });
  if (error) return fail(error, 'adjust stock');
  refreshStore();
  revalidatePath('/admin/inventory');
  return { ok: true, message: `Stock is now ${data as number}.` };
}

/** Drag-to-reorder: the full new order of a product's photos. */
export async function reorderImages(productId: string, imageIds: string[]): Promise<ActionState> {
  const { supabase } = await requirePermission('catalog');
  const pid = z.uuid().safeParse(productId);
  const ids = z.array(z.uuid()).min(1).max(50).safeParse(imageIds);
  if (!pid.success || !ids.success) return { ok: false, message: 'Invalid request.' };
  const { data: all } = await supabase.from('product_images').select('id, product_id, storage_path, alt, sort_order').eq('product_id', pid.data);
  const list = (all ?? []) as { id: string; product_id: string; storage_path: string; alt: string | null; sort_order: number }[];
  if (list.length !== ids.data.length || !ids.data.every((id) => list.some((x) => x.id === id))) {
    return { ok: false, message: 'The photos changed meanwhile. Reload and try again.' };
  }
  // One upsert statement; the unique (product_id, sort_order) constraint is
  // deferrable, so the new positions never collide mid-statement.
  const { error } = await supabase.from('product_images').upsert(ids.data.map((id, i) => ({ ...list.find((x) => x.id === id)!, sort_order: i })));
  if (error) return fail(error, 'reorder images');
  refreshStore();
  revalidatePath(`/admin/products/${pid.data}`);
  return { ok: true, message: 'Photo order saved.' };
}
