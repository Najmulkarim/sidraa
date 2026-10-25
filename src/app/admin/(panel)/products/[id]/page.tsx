import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { deleteProduct } from '@/actions/admin-catalog';
import { ImageManager } from '@/components/admin/ImageManager';
import { ProductForm } from '@/components/admin/ProductForm';
import { requirePermission } from '@/lib/auth';
import { sizeRank } from '@/lib/catalog';
import { NotifyOnLoad } from '@/components/admin/Toaster';
import type { Category, Product, ProductImage, Variant } from '@/lib/types';

export const metadata: Metadata = { title: 'Edit product' };

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; saved?: string; note?: string; error?: string }>;
}) {
  const [{ supabase }, { id }, sp] = await Promise.all([requirePermission('catalog'), params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [{ data: product }, { data: categories }, { count: orderCount }] = await Promise.all([
    supabase.from('products').select('*, images:product_images(*), variants:product_variants(*)').eq('id', id).maybeSingle(),
    supabase.from('categories').select('*').order('sort_order').order('name'),
    supabase.from('order_items').select('id', { count: 'exact', head: true }).eq('product_id', id),
  ]);
  if (!product) notFound();
  const p = product as Product & { images: ProductImage[]; variants: Variant[] };
  const images = [...p.images].sort((a, b) => a.sort_order - b.sort_order);
  const variants = [...p.variants].sort((a, b) => a.color.localeCompare(b.color) || sizeRank(a.size) - sizeRank(b.size) || (a.option3 ?? '').localeCompare(b.option3 ?? '') || a.sku.localeCompare(b.sku));
  const canDelete = (orderCount ?? 0) === 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end gap-3">
        <div>
          <Link href="/admin/products" className="text-sm text-muted hover:text-ink">← Products</Link>
          <h1 className="text-2xl font-bold tracking-tight">{p.name}</h1>
        </div>
        {p.status === 'published' && (
          <Link href={`/product/${p.slug}`} target="_blank" className="btn btn-ghost btn-sm ml-auto">View on shop ↗</Link>
        )}
      </header>

      {sp.created && <><NotifyOnLoad text="Product created." /><p className="rounded-xl bg-ok/10 px-4 py-3 text-sm text-ok">Product created.</p></>}
      {sp.saved && <><NotifyOnLoad text="Product saved." /><p className="rounded-xl bg-ok/10 px-4 py-3 text-sm text-ok" role="status">Saved.</p></>}
      {sp.note && <p className="rounded-xl bg-warn/10 px-4 py-3 text-sm text-warn">{sp.note.slice(0, 500)}</p>}
      {sp.error === 'delete' && <p className="rounded-xl bg-bad/10 px-4 py-3 text-sm text-bad">This product could not be deleted. Archive it instead.</p>}

      <ImageManager productId={p.id} images={images} productName={p.name} />
      <ProductForm key={p.updated_at} product={p} variants={variants} images={images} categories={(categories ?? []) as Category[]} />

      <section className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h2 className="font-semibold">Delete product</h2>
          <p className="text-sm text-muted">
            {(orderCount ?? 0) > 0
              ? `Used in ${orderCount} order line${orderCount === 1 ? '' : 's'}, so it cannot be deleted. Set the status to Archived to hide it.`
              : 'Removes the product, its variants and photos. This cannot be undone.'}
          </p>
        </div>
        {canDelete && (
          <form action={deleteProduct}>
            <input type="hidden" name="id" value={p.id} />
            <button className="btn btn-danger btn-sm">Delete permanently</button>
          </form>
        )}
      </section>
    </div>
  );
}
