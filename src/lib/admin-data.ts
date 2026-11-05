import 'server-only';
import { toNumber } from '@/lib/format';
import { countTags } from '@/lib/tags';
import type { createClient } from '@/lib/supabase/server';
import type { EditableOrder, VariantOption } from '@/lib/types';

type Db = Awaited<ReturnType<typeof createClient>>;

type VariantRow = {
  id: string;
  sku: string;
  size: string;
  option3: string;
  image_path: string | null;
  color: string;
  price: number | string | null;
  stock: number;
  is_active: boolean;
  product: { name: string; base_price: number | string; status: string; images: { storage_path: string; sort_order: number }[] } | null;
};

/** Every active size of every non-archived product, for the order editor. */
export async function loadVariantOptions(supabase: Db): Promise<VariantOption[]> {
  const { data, error } = await supabase
    .from('product_variants')
    .select('id, sku, size, color, option3, image_path, price, stock, is_active, product:products!inner(name, base_price, status, images:product_images(storage_path, sort_order))')
    .eq('is_active', true)
    .neq('product.status', 'archived')
    .limit(3000);
  if (error) console.error('[admin] variant options', error.message);
  return ((data ?? []) as unknown as VariantRow[])
    .filter((v) => v.product)
    .map((v) => ({
      variant_id: v.id,
      product_name: v.product!.name,
      label: [v.color, v.size, v.option3].filter(Boolean).join(' / '),
      sku: v.sku,
      price: toNumber(v.price ?? v.product!.base_price),
      stock: v.stock,
      image: v.image_path ?? [...(v.product!.images ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0]?.storage_path ?? null,
    }))
    .sort((a, b) => a.product_name.localeCompare(b.product_name) || a.sku.localeCompare(b.sku));
}

export async function loadEditableOrder(supabase: Db, id: string): Promise<EditableOrder | null> {
  const { data } = await supabase
    .from('orders')
    .select('id, public_ref, status, customer_name, customer_phone, address, district, area, note, zone_id, zone_name, delivery_charge, discount, paid_amount, total, source, courier_consignment_id, deleted_at, items:order_items(variant_id, product_name, variant_label, sku, unit_price, quantity, created_at)')
    .eq('id', id)
    .maybeSingle();
  if (!data || data.deleted_at) return null;
  const items = [...((data.items ?? []) as (EditableOrder['items'][number] & { created_at: string })[])].sort((a, b) => a.created_at.localeCompare(b.created_at));
  return {
    ...(data as unknown as EditableOrder),
    delivery_charge: toNumber(data.delivery_charge),
    discount: toNumber(data.discount),
    paid_amount: toNumber(data.paid_amount),
    total: toNumber(data.total),
    items: items.map(({ created_at: _c, ...i }) => ({ ...i, unit_price: toNumber(i.unit_price) })),
  };
}

/** Every tag used on any product, most used first (suggestions in the product form). */
export async function loadAllTags(supabase: Db): Promise<string[]> {
  const { data } = await supabase.from('products').select('tags').neq('tags', '{}').limit(5000);
  return countTags((data ?? []) as { tags: string[] | null }[]).map((t) => t.tag);
}

/** What the collection form needs: categories, tags in use and products to pick from. */
export async function loadCollectionFormData(supabase: Db) {
  const [{ data: cats }, tags, { data: prods }] = await Promise.all([
    supabase.from('categories').select('id, name, parent_id').order('sort_order').order('name'),
    loadAllTags(supabase),
    supabase.from('products').select('id, name, sku, status, images:product_images(storage_path, sort_order)').neq('status', 'archived').order('created_at', { ascending: false }).limit(2000),
  ]);
  return {
    categories: (cats ?? []) as { id: string; name: string; parent_id: string | null }[],
    tags,
    products: ((prods ?? []) as { id: string; name: string; sku: string; status: string; images: { storage_path: string; sort_order: number }[] }[]).map((p) => ({
      id: p.id, name: p.name, sku: p.sku, status: p.status, image: [...p.images].sort((a, b) => a.sort_order - b.sort_order)[0]?.storage_path ?? null,
    })),
  };
}
