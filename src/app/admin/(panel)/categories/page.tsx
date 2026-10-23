import type { Metadata } from 'next';
import { deleteCategory } from '@/actions/admin-catalog';
import { CategoryForm } from '@/components/admin/CategoryForm';
import { requirePermission } from '@/lib/auth';
import type { Category } from '@/lib/types';

export const metadata: Metadata = { title: 'Categories' };

export default async function CategoriesPage() {
  const { supabase } = await requirePermission('catalog');
  const { data } = await supabase.from('categories').select('*, products(count)').order('sort_order').order('name');
  const categories = (data ?? []) as (Category & { products: { count: number }[] })[];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Categories</h1>
        <p className="text-sm text-muted">Lower “Order” numbers appear first in the shop menu.</p>
      </header>

      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">Add a category</h2>
        <CategoryForm />
      </section>

      <section className="card divide-y divide-line">
        {categories.length === 0 && <p className="p-5 text-sm text-muted">No categories yet.</p>}
        {categories.map((c) => (
          <div key={c.id} className="space-y-2 p-5">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-muted">{c.products[0]?.count ?? 0} product{(c.products[0]?.count ?? 0) === 1 ? '' : 's'}</span>
              <form action={deleteCategory}>
                <input type="hidden" name="id" value={c.id} />
                <button className="text-sm text-bad underline" title="Products in it stay, without a category">Delete</button>
              </form>
            </div>
            <CategoryForm key={c.id} category={c} />
          </div>
        ))}
      </section>
    </div>
  );
}
