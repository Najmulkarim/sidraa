import type { Metadata } from 'next';
import Link from 'next/link';
import { deleteCategory } from '@/actions/admin-catalog';
import { CategoryForm } from '@/components/admin/CategoryForm';
import { requirePermission } from '@/lib/auth';
import type { Category } from '@/lib/types';

export const metadata: Metadata = { title: 'Categories' };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function DeleteButton({ id, small }: { id: string; small?: boolean }) {
  return (
    <form action={deleteCategory}>
      <input type="hidden" name="id" value={id} />
      <button className={`${small ? 'text-[12.5px]' : 'text-sm'} text-bad hover:underline`} title="Products in it stay, without this category">Delete</button>
    </form>
  );
}

/** Mother categories as large cards; their child categories as short rows inside, each opening to edit. */
export default async function CategoriesPage() {
  const { supabase } = await requirePermission('catalog');
  const [{ data }, { data: prods }] = await Promise.all([
    supabase.from('categories').select('*').order('sort_order').order('name'),
    supabase.from('products').select('category_id, extra_category_ids').neq('status', 'archived').limit(10000),
  ]);
  const all = (data ?? []) as Category[];
  // Products in each category, counting every category a product is ticked in.
  // A mother also counts its children's products (as its shop page shows them).
  const parentOf = new Map(all.map((c) => [c.id, c.parent_id ?? null]));
  const count: Record<string, number> = {};
  for (const p of (prods ?? []) as { category_id: string | null; extra_category_ids: string[] | null }[]) {
    const ids = new Set([p.category_id, ...(p.extra_category_ids ?? [])].filter((id): id is string => !!id));
    for (const id of [...ids]) { const m = parentOf.get(id); if (m) ids.add(m); }
    for (const id of ids) count[id] = (count[id] ?? 0) + 1;
  }
  // Only top-level categories can be mothers (one level: Clothing → Shirt).
  const mothers = all.filter((c) => !c.parent_id || !all.some((m) => m.id === c.parent_id));
  const childrenOf = (id: string) => all.filter((c) => c.parent_id === id);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Categories</h1>
        <p className="text-sm text-muted">To group categories, choose a <b>Mother category</b> — e.g. Shirt, T-Shirt and Pant under Clothing. The shop menu shows the mothers; a mother’s page also shows its children’s products. Lower “Order” numbers come first.</p>
      </header>

      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">Add a category</h2>
        <CategoryForm mothers={mothers} />
      </section>

      {all.length === 0 && <p className="card p-5 text-sm text-muted">No categories yet.</p>}

      {mothers.map((m) => {
        const kids = childrenOf(m.id);
        return (
          <section key={m.id} className="card overflow-hidden">
            {/* The mother: big name, opens to edit. */}
            <details className="group">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 p-5 [&::-webkit-details-marker]:hidden">
                <h2 className="text-xl font-bold">{m.name}</h2>
                <span className="text-sm text-muted">
                  {kids.length > 0 && <>{plural(kids.length, 'child category', 'child categories')} · </>}
                  {plural(count[m.id] ?? 0, 'product', 'products')}
                  {!m.is_public && <span className="ml-2 rounded bg-soft px-1.5 py-0.5 text-[11px] font-semibold">Hidden</span>}
                </span>
                <span className="ml-auto flex items-center gap-4">
                  <Link href={`/category/${m.slug}`} target="_blank" className="text-sm text-muted hover:text-brand">View ↗</Link>
                  <span className="text-sm font-semibold text-brand group-open:hidden">Edit</span>
                  <span className="hidden text-sm font-semibold text-muted group-open:inline">Close</span>
                </span>
              </summary>
              <div className="space-y-3 border-t border-line bg-soft/40 p-5">
                <CategoryForm category={m} mothers={mothers} hasChildren={kids.length > 0} />
                <div className="flex justify-end"><DeleteButton id={m.id} /></div>
              </div>
            </details>

            {/* The children: one short line each. */}
            {kids.length > 0 && (
              <ul className="divide-y divide-line border-t border-line">
                {kids.map((c) => (
                  <li key={c.id}>
                    <details className="group/child">
                      <summary className="flex cursor-pointer list-none items-center gap-3 py-2.5 pl-8 pr-5 text-[14px] hover:bg-soft/60 [&::-webkit-details-marker]:hidden">
                        <span className="text-brand" aria-hidden>↳</span>
                        <span className="font-medium">{c.name}</span>
                        <span className="text-[12.5px] text-muted">{plural(count[c.id] ?? 0, 'product', 'products')}</span>
                        {!c.is_public && <span className="rounded bg-soft px-1.5 py-0.5 text-[11px] font-semibold text-muted">Hidden</span>}
                        <span className="ml-auto flex items-center gap-4 text-[12.5px]">
                          <Link href={`/category/${c.slug}`} target="_blank" className="text-muted hover:text-brand">View ↗</Link>
                          <span className="font-semibold text-brand group-open/child:hidden">Edit</span>
                          <span className="hidden font-semibold text-muted group-open/child:inline">Close</span>
                        </span>
                      </summary>
                      <div className="space-y-3 bg-soft/40 py-4 pl-8 pr-5">
                        <CategoryForm category={c} mothers={mothers} />
                        <div className="flex justify-end"><DeleteButton id={c.id} small /></div>
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
