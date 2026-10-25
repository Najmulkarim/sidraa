import type { Metadata } from 'next';
import { Listing } from '@/components/shop/Listing';
import { getShopCategories } from '@/lib/catalog';

export const metadata: Metadata = {
  title: 'All products',
  alternates: { canonical: '/products' },
};

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [sp, categories] = await Promise.all([searchParams, getShopCategories()]);
  return (
    <div className="container-page py-10">
      <header className="mb-8">
        <p className="eyebrow">Shop</p>
        <h1 className="font-display text-4xl font-semibold">All products</h1>
      </header>
      <Listing basePath="/products" searchParams={sp} categories={categories} showCategoryFilter />
    </div>
  );
}
