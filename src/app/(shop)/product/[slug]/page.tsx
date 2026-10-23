import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AddToCart } from '@/components/shop/AddToCart';
import { Gallery } from '@/components/shop/Gallery';
import { VariantImageProvider } from '@/components/shop/VariantImage';
import { ProductGrid } from '@/components/shop/ProductCard';
import { getProductBySlug, getRelatedProducts, getSettings, getZones, priceRange, totalStock, variantPrice } from '@/lib/catalog';
import { imageUrl, SITE_URL } from '@/lib/env';
import { formatTaka, toNumber } from '@/lib/format';

export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) return { title: 'Not found' };
  const description = p.seo_description ?? p.description?.slice(0, 160) ?? `Buy ${p.name} with cash on delivery.`;
  const img = imageUrl(p.images[0]?.storage_path);
  return {
    title: p.seo_title ?? p.name,
    description,
    alternates: { canonical: `/product/${p.slug}` },
    openGraph: { title: p.seo_title ?? p.name, description, url: `/product/${p.slug}`, images: img ? [{ url: img }] : undefined },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const [product, settings, zones] = await Promise.all([getProductBySlug(slug), getSettings(), getZones()]);
  if (!product) notFound();

  const related = await getRelatedProducts(product.id, product.category_id);
  const variants = product.variants
    .filter((v) => v.is_active)
    .map((v) => ({ id: v.id, color: v.color, size: v.size, option3: v.option3 ?? '', image_path: v.image_path ?? null, price: variantPrice(product, v), stock: v.stock }));
  const { min, max } = priceRange(product);
  const inStock = totalStock(product) > 0;
  const compare = product.compare_at_price === null ? null : toNumber(product.compare_at_price);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description ?? undefined,
    sku: product.variants[0]?.sku,
    image: product.images.map((i) => imageUrl(i.storage_path)).filter(Boolean),
    brand: { '@type': 'Brand', name: settings.store_name },
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'BDT',
      lowPrice: min,
      highPrice: max,
      offerCount: variants.length,
      availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: `${SITE_URL}/product/${product.slug}`,
    },
  };

  return (
    <div className="container-page py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />

      <nav className="mb-6 text-sm text-muted" aria-label="Breadcrumb">
        <ol className="flex flex-wrap gap-1">
          <li><Link href="/" className="hover:text-ink">Home</Link> /</li>
          {product.category && (
            <li><Link href={`/category/${product.category.slug}`} className="hover:text-ink">{product.category.name}</Link> /</li>
          )}
          <li aria-current="page" className="text-ink">{product.name}</li>
        </ol>
      </nav>

      <VariantImageProvider>
      <div className="grid gap-10 lg:grid-cols-2">
        <Gallery images={product.images} name={product.name} />

        <div className="space-y-8 lg:pt-4">
          <header className="space-y-2">
            {product.category && <p className="eyebrow">{product.category.name}</p>}
            <h1 className="font-display text-4xl font-semibold leading-tight sm:text-5xl">{product.name}</h1>
          </header>

          {variants.length > 0 ? (
            <AddToCart
              productId={product.id}
              productName={product.name}
              productSlug={product.slug}
              imagePath={product.images[0]?.storage_path ?? null}
              compareAt={compare}
              variants={variants}
              labels={{ color_label: product.color_label, size_label: product.size_label, option3_label: product.option3_label }}
              imageOrder={product.images.map((i) => i.storage_path)}
            />
          ) : (
            <p className="text-muted">This product is not available right now.</p>
          )}

          <div className="card divide-y divide-line text-sm">
            <div className="p-4">
              <p className="font-semibold">Cash on delivery</p>
              <p className="mt-1 text-muted">{settings.cod_terms}</p>
            </div>
            {zones.length > 0 && (
              <div className="p-4">
                <p className="font-semibold">Delivery</p>
                <ul className="mt-1 space-y-0.5 text-muted">
                  {zones.map((z) => (
                    <li key={z.id}>
                      {z.name}: {formatTaka(z.charge)}
                      {z.eta_text ? ` · ${z.eta_text}` : ''}
                      {z.free_over !== null ? ` · free over ${formatTaka(z.free_over)}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="p-4">
              <p className="font-semibold">Returns</p>
              <p className="mt-1 text-muted">
                Tell us within {settings.return_policy_days} day{settings.return_policy_days === 1 ? '' : 's'} of delivery.{' '}
                <Link href="/info/returns" className="underline">Return policy</Link>
              </p>
            </div>
          </div>

          {product.description && (
            <section>
              <h2 className="mb-2 font-display text-2xl font-semibold">Details</h2>
              <div className="whitespace-pre-line text-[0.95rem] leading-relaxed text-ink/85">{product.description}</div>
            </section>
          )}
        </div>
      </div>
      </VariantImageProvider>

      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="mb-6 font-display text-3xl font-semibold">You may also like</h2>
          <ProductGrid products={related} />
        </section>
      )}
    </div>
  );
}
