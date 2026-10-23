import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Listing } from '@/components/shop/Listing';
import { getCategories } from '@/lib/catalog';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = (await getCategories()).find((c) => c.slug === slug);
  if (!category) return { title: 'Not found' };
  return {
    title: category.name,
    description: category.description ?? `Shop ${category.name}. Cash on delivery across Bangladesh.`,
    alternates: { canonical: `/category/${category.slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const [{ slug }, sp, categories] = await Promise.all([params, searchParams, getCategories()]);
  const category = categories.find((c) => c.slug === slug);
  if (!category) notFound();

  return (
    <div className="container-page py-10">
      <header className="mb-8 space-y-2">
        <p className="eyebrow">Category</p>
        <h1 className="font-display text-4xl font-semibold">{category.name}</h1>
        {category.description && <p className="max-w-2xl text-muted">{category.description}</p>}
      </header>
      <Listing basePath={`/category/${category.slug}`} searchParams={sp} category={category} categories={categories} showCategoryFilter={false} />
    </div>
  );
}
