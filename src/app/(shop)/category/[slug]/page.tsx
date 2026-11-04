import type { Metadata } from 'next';
import Link from 'next/link';
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
  const mother = category.parent_id ? categories.find((c) => c.id === category.parent_id) : undefined;
  const children = categories.filter((c) => c.parent_id === category.id);

  return (
    <div className="container-page py-10">
      <header className="mb-8 space-y-2">
        <p className="eyebrow">{mother ? <Link href={`/category/${mother.slug}`} className="hover:underline">{mother.name}</Link> : 'Category'}</p>
        <h1 className="font-display text-4xl font-semibold">{category.name}</h1>
        {category.description && <p className="max-w-2xl text-muted">{category.description}</p>}
        {children.length > 0 && (
          <nav aria-label={`${category.name} categories`} className="flex flex-wrap gap-2 pt-2">
            <span className="rounded-full bg-night px-4 py-1.5 text-[13px] font-semibold text-white">All {category.name}</span>
            {children.map((c) => (
              <Link key={c.id} href={`/category/${c.slug}`} className="rounded-full border border-line bg-white px-4 py-1.5 text-[13px] font-medium hover:border-brand hover:text-brand">{c.name}</Link>
            ))}
          </nav>
        )}
      </header>
      <Listing basePath={`/category/${category.slug}`} searchParams={sp} category={category} categories={categories} showCategoryFilter={false} />
    </div>
  );
}
