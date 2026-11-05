import type { Metadata } from 'next';
import Link from 'next/link';
import { CollectionForm } from '@/components/admin/CollectionForm';
import { loadCollectionFormData } from '@/lib/admin-data';
import { requirePermission } from '@/lib/auth';

export const metadata: Metadata = { title: 'New collection' };

export default async function NewCollectionPage() {
  const { supabase } = await requirePermission('catalog');
  const data = await loadCollectionFormData(supabase);
  return (
    <div className="space-y-6">
      <header>
        <Link href="/admin/collections" className="text-sm text-muted hover:text-ink">← Collections</Link>
        <h1 className="text-2xl font-bold tracking-tight">New collection</h1>
      </header>
      <CollectionForm {...data} />
    </div>
  );
}
