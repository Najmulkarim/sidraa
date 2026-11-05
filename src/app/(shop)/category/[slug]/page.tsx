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
    <div className="container-page py-6 md:py-10">
      <header className="mb-5 space-y-1.5 md:mb-8 md:space-y-2">
        <p className="eyebrow">{mother ? <Link href={`/category/${mother.slug}`} className="hover:underline">{mother.name}</Link> : 'Category'}</p>
        <h1 className="font-display text-3xl font-semibold md:text-4xl">{category.name}</h1>
        {category.description && <p className="max-w-2xl text-[14px] text-muted md:text-base">{category.description}</p>}
        {children.length > 0 && (
          <nav aria-label={`${category.name} categories`} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 pt-2 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0 [&::-webkit-scrollbar]:hidden">
            <span className="shrink-0 rounded-full bg-night px-4 py-1.5 text-[13px] font-semibold text-white">All {category.name}</span>
            {children.map((c) => (
              <Link key={c.id} href={`/category/${c.slug}`} className="shrink-0 rounded-full border border-line bg-white px-4 py-1.5 text-[13px] font-medium hover:border-brand hover:text-brand">{c.name}</Link>
            ))}
          </nav>
        )}
      </header>
      <Listing basePath={`/category/${category.slug}`} searchParams={sp} category={category} categories={categories} showCategoryFilter={false} hideChips={children.length > 0} />
    </div>
  );
}
