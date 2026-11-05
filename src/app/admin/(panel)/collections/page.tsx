import type { Metadata } from 'next';
import Link from 'next/link';
import { CollectionRowActions } from '@/components/admin/CollectionRowActions';
import { Icon } from '@/components/icons';
import { requirePermission } from '@/lib/auth';
import { describeRules, type CollectionRow } from '@/lib/collections';

export const metadata: Metadata = { title: 'Collections' };

/** Every collection, with its rules in words; open one to edit, or delete it. */
export default async function CollectionsPage({ searchParams }: { searchParams: Promise<{ created?: string }> }) {
  const [{ supabase }, sp] = await Promise.all([requirePermission('catalog'), searchParams]);
  const [{ data, error }, { data: cats }] = await Promise.all([
    supabase.from('collections').select('id, name, slug, description, is_public, match, rules, product_ids, sort_order').order('sort_order').order('name'),
    supabase.from('categories').select('id, name'),
  ]);
  const rows = (data ?? []) as CollectionRow[];
  const catName = new Map(((cats ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Collections</h1>
          <p className="max-w-2xl text-sm text-muted">Groups of products by tag, category, name, SKU or price — or picked by hand. Each has its own page (<span className="font-mono">/collections/…</span>) and can be shown on the Homepage. New products that match join by themselves.</p>
        </div>
        <Link href="/admin/collections/new" className="btn btn-primary"><Icon name="plus" size={16} /> New collection</Link>
      </header>

      {sp.created && <p className="rounded-xl bg-ok/10 px-4 py-3 text-sm font-medium text-ok">Collection created.</p>}
      {error && <p className="rounded-xl bg-warn/10 px-4 py-3 text-sm text-warn">Run the latest database update (0048) in Supabase to use collections.</p>}
      {!error && rows.length === 0 && (
        <div className="card p-10 text-center">
          <p className="font-semibold">No collections yet</p>
          <p className="mt-1 text-sm text-muted">For example “Eid Collection”: every product tagged Eid Sale, or every scarf under ৳700.</p>
          <Link href="/admin/collections/new" className="btn btn-primary mt-4">Create the first one</Link>
        </div>
      )}

      {rows.length > 0 && (
        <ul className="card divide-y divide-line overflow-hidden">
          {rows.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
              <Link href={`/admin/collections/${c.id}`} className="min-w-0 flex-1 basis-64">
                <span className="flex items-center gap-2">
                  <span className="truncate font-semibold hover:text-brand">{c.name}</span>
                  {!c.is_public && <span className="rounded bg-soft px-1.5 py-0.5 text-[11px] font-semibold text-muted">Hidden</span>}
                </span>
                <span className="block truncate text-[12.5px] text-muted">{describeRules(c, (id) => catName.get(id))}</span>
              </Link>
              <span className="font-mono text-[12px] text-muted">/collections/{c.slug}</span>
              <CollectionRowActions id={c.id} name={c.name} slug={c.slug} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
