'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth';
import { CATALOG_TAG } from '@/lib/catalog';
import { mapDbError } from '@/lib/db-errors';
import { IMAGE_BUCKET } from '@/lib/env';
import type { ActionState } from '@/lib/types';
import { adjustStockSchema, categorySchema, fieldErrors, formToObject, imageMetaSchema, productSchema } from '@/lib/validation';

/** Every catalogue change refreshes the cached storefront pages. */
function refreshStore() {
  revalidatePath('/', 'layout');
  updateTag(CATALOG_TAG);
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
    discount_style: p.discountStyle,
    status: p.status,
    is_featured: p.isFeatured,
    stock_out_mode: p.stockOutMode,
    preorder_days: p.stockOutMode === 'preorder' ? (p.preorderDays ?? 7) : null,
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

  // Cost per variation (staff-only table): saved after each variation, by its id.
  const variantCosts: { id: string; cost: number | null }[] = [];
  for (const v of p.variants) {
    // Variation photos must be this product's own photos (the database checks too).
    const imagePath = v.imagePath && photos.has(v.imagePath) ? v.imagePath : null;
    // An empty SKU on a new variation is left out, so the database assigns <product SKU>-01, -02, …
    const fields = { ...(v.sku ? { sku: v.sku } : {}), size: v.size, color: v.color, option3: v.option3, image_path: imagePath, price: v.price, is_active: v.isActive };
    const label = v.sku || [v.color, v.size, v.option3].filter(Boolean).join(' / ') || 'New variation';
    if (v.id) {
      const { error } = await supabase.from('product_variants').update(fields).eq('id', v.id);
      if (error) return bail(`${label}: ${fail(error, 'update variant').message}`);
      variantCosts.push({ id: v.id, cost: v.cost });
    } else {
      const { data, error } = await supabase
        .from('product_variants')
        .insert({ ...fields, product_id: productId, stock: 0 })
        .select('id, sku')
        .single<{ id: string; sku: string }>();
      if (error || !data) return bail(`${label}: ${fail(error, 'insert variant').message}`);
      variantCosts.push({ id: data.id, cost: v.cost });
      if (v.openingStock > 0) {
        const { error: stockError } = await supabase.rpc('adjust_stock', {
          p_variant_id: data.id,
          p_change: v.openingStock,
          p_reason: 'restock',
          p_note: 'Opening stock',
        });
        if (stockError) notes.push(`${data.sku}: opening stock not saved (${mapDbError(stockError).message})`);
      }
    }
  }

  // Cost prices: set, or cleared when the box is emptied.
  const costErrors = await Promise.all([
    p.costPrice === undefined
      ? supabase.from('product_costs').delete().eq('product_id', productId)
      : supabase.from('product_costs').upsert({ product_id: productId, cost: p.costPrice, updated_at: new Date().toISOString() }),
    ...variantCosts.filter((c) => c.cost === null).map((c) => supabase.from('variant_costs').delete().eq('variant_id', c.id)),
    ...(variantCosts.some((c) => c.cost !== null)
      ? [supabase.from('variant_costs').upsert(variantCosts.filter((c) => c.cost !== null).map((c) => ({ variant_id: c.id, cost: c.cost, updated_at: new Date().toISOString() })))]
      : []),
  ]);
  if (costErrors.some((r) => r.error)) notes.push('Cost price not saved — run the latest database update (0033) in Supabase.');

  refreshStore();
  // Redirect so the form remounts with the saved variant ids.
  const qs = new URLSearchParams(p.id ? { saved: '1' } : { created: '1' });
  if (notes.length) qs.set('note', notes.join(' ').slice(0, 500));
  redirect(`/admin/products/${productId}?${qs.toString()}`);
}

type Db = Awaited<ReturnType<typeof requirePermission>>['supabase'];

/** Deletes the product and its photo files. False when RLS refused (the product appears in orders). */
async function removeProduct(supabase: Db, id: string): Promise<boolean> {
  const { data: images } = await supabase.from('product_images').select('storage_path').eq('product_id', id);
  const { error, count } = await supabase.from('products').delete({ count: 'exact' }).eq('id', id);
  if (error || count === 0) return false;
  const paths = (images ?? []).map((i: { storage_path: string }) => i.storage_path).filter((p) => !p.startsWith('/'));
  if (paths.length) await supabase.storage.from(IMAGE_BUCKET).remove(paths);
  refreshStore();
  return true;
}

export async function deleteProduct(formData: FormData): Promise<void> {
  const { supabase } = await requirePermission('catalog');
  const id = z.uuid().parse(formData.get('id'));
  if (!(await removeProduct(supabase, id))) redirect(`/admin/products/${id}?error=delete`);
  redirect('/admin/products?deleted=1');
}

/** Delete from the product list, staying on the same page. */
export async function deleteProductFromList(productId: string): Promise<ActionState> {
  const { supabase } = await requirePermission('catalog');
  const id = z.uuid().safeParse(productId);
  if (!id.success) return { ok: false, message: 'Invalid product.' };
  if (!(await removeProduct(supabase, id.data))) {
    return { ok: false, message: 'Not deleted: this product appears in orders, so it can only be archived (open it and set Status to Archived).' };
  }
  revalidatePath('/admin/products');
  return { ok: true, message: 'Product deleted.' };
}

/** The Published and Featured switches on the product list. */
export async function setProductFlags(productId: string, flags: { published?: boolean; featured?: boolean }): Promise<ActionState> {
  const { supabase } = await requirePermission('catalog');
  const id = z.uuid().safeParse(productId);
  if (!id.success) return { ok: false, message: 'Invalid product.' };
  const update: { status?: 'published' | 'draft'; is_featured?: boolean } = {};
  if (typeof flags.published === 'boolean') update.status = flags.published ? 'published' : 'draft';
  if (typeof flags.featured === 'boolean') update.is_featured = flags.featured;
  if (!Object.keys(update).length) return { ok: true };
  const { error } = await supabase.from('products').update(update).eq('id', id.data);
  if (error) return fail(error, 'product flags');
  refreshStore();
  revalidatePath('/admin/products');
  return { ok: true };
}

type CopySource = {
  name: string;
  slug: string;
  category_id: string | null;
  description: string | null;
  base_price: number | string;
  compare_at_price: number | string | null;
  discount_style: 'percent' | 'amount';
  stock_out_mode: 'sold_out' | 'preorder' | 'continue';
  preorder_days: number | null;
  seo_title: string | null;
  seo_description: string | null;
  color_label: string;
  size_label: string;
  option3_label: string | null;
  images: { storage_path: string; alt: string | null; sort_order: number }[];
  variants: { sku: string; size: string; color: string; option3: string; image_path: string | null; price: number | string | null; is_active: boolean }[];
};

/**
 * Copies a product as a draft: same details and variations with new SKUs
 * (a new product SKU, variations numbered -01, -02, … under it)
 * and zero stock (stock only ever arrives through logged movements), and
 * its own copies of the photo files, so deleting one product's photos
 * never breaks the other.
 */
export async function duplicateProduct(productId: string): Promise<ActionState> {
  const { supabase } = await requirePermission('catalog');
  const id = z.uuid().safeParse(productId);
  if (!id.success) return { ok: false, message: 'Invalid product.' };
  const { data, error: readError } = await supabase
    .from('products')
    .select('name, slug, category_id, description, base_price, compare_at_price, discount_style, stock_out_mode, preorder_days, seo_title, seo_description, color_label, size_label, option3_label, images:product_images(storage_path, alt, sort_order), variants:product_variants(sku, size, color, option3, image_path, price, is_active)')
    .eq('id', id.data)
    .single();
  if (readError || !data) return { ok: false, message: 'Product not found.' };
  const src = data as unknown as CopySource;

  // Free slug: name-copy, name-copy-2, …
  const baseSlug = `${src.slug.slice(0, 70)}-copy`;
  const { data: taken } = await supabase.from('products').select('slug').like('slug', `${baseSlug}%`);
  const takenSlugs = new Set((taken ?? []).map((r: { slug: string }) => r.slug));
  let slug = baseSlug;
  for (let n = 2; takenSlugs.has(slug); n++) slug = `${baseSlug}-${n}`;

  const { data: created, error: insertError } = await supabase
    .from('products')
    .insert({
      name: `${src.name.slice(0, 153)} (copy)`,
      slug,
      category_id: src.category_id,
      description: src.description,
      base_price: src.base_price,
      compare_at_price: src.compare_at_price,
      discount_style: src.discount_style,
      stock_out_mode: src.stock_out_mode,
      preorder_days: src.preorder_days,
      status: 'draft',
      is_featured: false,
      seo_title: src.seo_title,
      seo_description: src.seo_description,
      color_label: src.color_label,
      size_label: src.size_label,
      option3_label: src.option3_label,
    })
    .select('id')
    .single<{ id: string }>();
  if (insertError || !created) return fail(insertError, 'duplicate product');
  const newId = created.id;

  const copied: string[] = [];
  const undo = async (message: string): Promise<ActionState> => {
    await supabase.from('products').delete().eq('id', newId);
    if (copied.length) await supabase.storage.from(IMAGE_BUCKET).remove(copied);
    return { ok: false, message };
  };

  // Photos: uploaded files are copied under the new product's folder; site files (/demo/…) are shared as they are.
  const pathMap = new Map<string, string>();
  for (const img of src.images) {
    if (img.storage_path.startsWith('/')) {
      pathMap.set(img.storage_path, img.storage_path);
      continue;
    }
    const to = `products/${newId}/${img.storage_path.split('/').pop()}`;
    const { error } = await supabase.storage.from(IMAGE_BUCKET).copy(img.storage_path, to);
    if (error) return undo(`Could not copy a photo: ${error.message}`);
    copied.push(to);
    pathMap.set(img.storage_path, to);
  }
  if (src.images.length) {
    const { error } = await supabase
      .from('product_images')
      .insert(src.images.map((img) => ({ product_id: newId, storage_path: pathMap.get(img.storage_path)!, alt: img.alt, sort_order: img.sort_order })));
    if (error) return undo(fail(error, 'duplicate photos').message ?? 'Could not copy the photos.');
  }
  if (src.variants.length) {
    const { error } = await supabase.from('product_variants').insert(
      src.variants.map((v) => ({
        product_id: newId,
        // No sku: the database assigns <new product SKU>-01, -02, …
        size: v.size,
        color: v.color,
        option3: v.option3,
        image_path: v.image_path ? (pathMap.get(v.image_path) ?? null) : null,
        price: v.price,
        is_active: v.is_active,
        stock: 0,
      })),
    );
    if (error) return undo(fail(error, 'duplicate variants').message ?? 'Could not copy the variations.');
  }

  revalidatePath('/admin/products');
  return { ok: true, message: `Copied as a draft: ${src.name} (copy). Stock starts at 0.` };
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
