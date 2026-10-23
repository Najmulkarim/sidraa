import type { Metadata } from 'next';
import Link from 'next/link';
import { ProductForm } from '@/components/admin/ProductForm';
import { requirePermission } from '@/lib/auth';
import type { Category } from '@/lib/types';

export const metadata: Metadata = { title: 'New product' };

export default async function NewProductPage() {
  const { supabase } = await requirePermission('catalog');
  const { data } = await supabase.from('categories').select('*').order('sort_order').order('name');
  return (
    <div className="space-y-6">
      <header>
        <Link href="/admin/products" className="text-sm text-muted hover:text-ink">← Products</Link>
        <h1 className="text-2xl font-bold tracking-tight">New product</h1>
        <p className="text-sm text-muted">Add the name, photos, variations and price, then create the product.</p>
      </header>
      <ProductForm categories={(data ?? []) as Category[]} />
    </div>
  );
}
