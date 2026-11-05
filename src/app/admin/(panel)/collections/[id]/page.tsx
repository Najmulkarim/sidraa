import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CollectionForm } from '@/components/admin/CollectionForm';
import { loadCollectionFormData } from '@/lib/admin-data';
import { requirePermission } from '@/lib/auth';
import type { CollectionRow } from '@/lib/collections';

export const metadata: Metadata = { title: 'Edit collection' };

export default async function EditCollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ supabase }, { id }] = await Promise.all([requirePermission('catalog'), params]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [{ data: c }, data] = await Promise.all([
    supabase.from('collections').select('id, name, slug, description, is_public, match, rules, product_ids, sort_order, updated_at').eq('id', id).maybeSingle<CollectionRow>(),
    loadCollectionFormData(supabase),
  ]);
  if (!c) notFound();
  return (
    <div className="space-y-6">
      <header>
        <Link href="/admin/collections" className="text-sm text-muted hover:text-ink">← Collections</Link>
        <h1 className="text-2xl font-bold tracking-tight">{c.name}</h1>
      </header>
      <CollectionForm key={c.updated_at} collection={c} {...data} />
    </div>
  );
}
