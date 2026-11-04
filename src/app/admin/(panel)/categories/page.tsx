import type { Metadata } from 'next';
import { deleteCategory } from '@/actions/admin-catalog';
import { CategoryForm } from '@/components/admin/CategoryForm';
import { requirePermission } from '@/lib/auth';
import type { Category } from '@/lib/types';

export const metadata: Metadata = { title: 'Categories' };

export default async function CategoriesPage() {
  const { supabase } = await requirePermission('catalog');
  const { data } = await supabase.from('categories').select('*, products(count)').order('sort_order').order('name');
  const all = (data ?? []) as (Category & { products: { count: number }[] })[];
  // Only top-level categories can be mothers (one level: Clothing → Shirt).
  const mothers = all.filter((c) => !c.parent_id);
  const childrenOf = (id: string) => all.filter((c) => c.parent_id === id);
  // Each mother followed by its children; a child whose mother is gone shows at the top level.
  const categories = [...mothers.flatMap((m) => [m, ...childrenOf(m.id)]), ...all.filter((c) => c.parent_id && !all.some((m) => m.id === c.parent_id))];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Categories</h1>
        <p className="text-sm text-muted">Lower “Order” numbers appear first in the shop menu. To group categories, choose a <b>Mother category</b> — e.g. Shirt, T-Shirt and Pant under Clothing. The shop menu shows the mothers; each mother’s page also shows its children’s products.</p>
      </header>

      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">Add a category</h2>
        <CategoryForm mothers={mothers} />
      </section>

      <section className="card divide-y divide-line">
        {categories.length === 0 && <p className="p-5 text-sm text-muted">No categories yet.</p>}
        {categories.map((c) => (
          <div key={c.id} className={`space-y-2 p-5 ${c.parent_id ? 'border-l-4 border-l-tint bg-soft/40 pl-8' : ''}`}>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-muted">
                {c.parent_id ? <span className="mr-2 font-semibold text-brand">↳ under {all.find((m) => m.id === c.parent_id)?.name}</span> : childrenOf(c.id).length > 0 ? <span className="mr-2 font-semibold text-ink">Mother · {childrenOf(c.id).length} child categor{childrenOf(c.id).length === 1 ? 'y' : 'ies'}</span> : null}
                {c.products[0]?.count ?? 0} product{(c.products[0]?.count ?? 0) === 1 ? '' : 's'}
              </span>
              <form action={deleteCategory}>
                <input type="hidden" name="id" value={c.id} />
                <button className="text-sm text-bad underline" title="Products in it stay, without a category">Delete</button>
              </form>
            </div>
            <CategoryForm key={c.id} category={c} mothers={mothers} hasChildren={childrenOf(c.id).length > 0} />
          </div>
        ))}
      </section>
    </div>
  );
}
