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
import { parseDescription, splitBullet } from '@/lib/product-content';
import { Icon } from '@/components/icons';

export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

/**
 * No pages at build time; each product page is rendered on its first visit
 * and then served from the cache (ISR) until it expires or an order / admin
 * save revalidates it. Without this the route renders on every request.
 */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return [];
}

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

  const related = await getRelatedProducts(product.id, product.category_id, 6);
  const variants = product.variants
    .filter((v) => v.is_active)
    .map((v) => ({ id: v.id, color: v.color, size: v.size, option3: v.option3 ?? '', image_path: v.image_path ?? null, price: variantPrice(product, v), stock: v.stock, sku: v.sku }));
  const { min, max } = priceRange(product);
  const inStock = totalStock(product) > 0;
  const compare = product.compare_at_price === null ? null : toNumber(product.compare_at_price);
  const percentOff = compare !== null && compare > min ? Math.round((1 - min / compare) * 100) : 0;
  const content = parseDescription(product.description);
  const productUrl = `${SITE_URL}/product/${product.slug}`;
  const activeZones = zones.filter((z) => z.is_active !== false);
  const freeOver = activeZones.map((z) => (z.free_over === null ? null : Number(z.free_over))).filter((n): n is number => n !== null);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description ?? undefined,
    sku: product.sku,
    image: product.images.map((i) => imageUrl(i.storage_path)).filter(Boolean),
    brand: { '@type': 'Brand', name: settings.store_name },
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'BDT',
      lowPrice: min,
      highPrice: max,
      offerCount: variants.length,
      availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: productUrl,
    },
  };

  const header = (
    <header className="space-y-2">
      {product.category && (
        <Link href={`/category/${product.category.slug}`} className="text-[13px] font-semibold text-brand-ink hover:underline">
          Visit the {product.category.name} collection
        </Link>
      )}
      <h1 className="text-[1.45rem] font-semibold leading-snug sm:text-[1.7rem]">{product.name}</h1>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
        {product.sku && (
          <span>
            SKU: <span className="font-mono font-semibold text-ink">{product.sku}</span>
          </span>
        )}
        <span className={inStock ? 'text-ok' : 'text-bad'}>{inStock ? 'In stock' : 'Out of stock'}</span>
      </p>
    </header>
  );

  const delivery = activeZones.length > 0 && (
    <div className="space-y-1">
      <p className="font-semibold text-ink">Delivery</p>
      <ul className="space-y-0.5">
        {activeZones.map((z) => (
          <li key={z.id} className="flex justify-between gap-2">
            <span>{z.name}{z.eta_text ? <span className="text-muted"> · {z.eta_text}</span> : null}</span>
            <span className="shrink-0 font-semibold">{formatTaka(z.charge)}</span>
          </li>
        ))}
      </ul>
      {freeOver.length > 0 && <p className="font-semibold text-ok">FREE delivery on orders over {formatTaka(Math.min(...freeOver))}</p>}
    </div>
  );

  const details = (
    <>
      {content.bullets.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold">About this item</h2>
          <ul className="space-y-2 text-[15px] leading-relaxed">
            {content.bullets.map((b, i) => {
              const [lead, rest] = splitBullet(b);
              return (
                <li key={i} className="flex gap-2.5">
                  <Icon name="check" size={18} className="mt-0.5 shrink-0 text-ok" />
                  <span>{lead ? <><b className="font-semibold">{lead}</b> – {rest}</> : rest}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {(content.specs.length > 0 || product.category || product.sku) && (
        <section>
          <h2 className="mb-3 text-lg font-bold">Product details</h2>
          <table className="w-full overflow-hidden rounded-xl border border-line text-[14px]">
            <tbody>
              {content.specs.map(([k, v]) => (
                <tr key={k} className="border-b border-line last:border-0">
                  <th scope="row" className="w-2/5 bg-soft px-3 py-2.5 text-left font-semibold">{k}</th>
                  <td className="px-3 py-2.5">{v}</td>
                </tr>
              ))}
              {product.category && (
                <tr className="border-b border-line last:border-0">
                  <th scope="row" className="w-2/5 bg-soft px-3 py-2.5 text-left font-semibold">Category</th>
                  <td className="px-3 py-2.5"><Link href={`/category/${product.category.slug}`} className="text-brand-ink hover:underline">{product.category.name}</Link></td>
                </tr>
              )}
              {product.sku && (
                <tr className="border-b border-line last:border-0">
                  <th scope="row" className="w-2/5 bg-soft px-3 py-2.5 text-left font-semibold">SKU</th>
                  <td className="px-3 py-2.5 font-mono">{product.sku}</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}
      {content.text && (
        <section>
          <h2 className="mb-3 text-lg font-bold">Description</h2>
          <div className="whitespace-pre-line text-[15px] leading-relaxed text-ink/85">{content.text}</div>
        </section>
      )}
      <section className="card grid gap-3 p-4 text-[13px] sm:grid-cols-2">
        <div>
          <p className="font-semibold">Cash on delivery</p>
          <p className="mt-0.5 text-muted">{settings.cod_terms}</p>
        </div>
        <div>
          <p className="font-semibold">Returns</p>
          <p className="mt-0.5 text-muted">
            Tell us within {settings.return_policy_days} day{settings.return_policy_days === 1 ? '' : 's'} of delivery. <Link href="/info/returns" className="underline">Return policy</Link>
          </p>
        </div>
      </section>
    </>
  );

  return (
    <div className="container-page py-5 md:py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />

      <nav className="mb-4 text-[13px] text-muted md:mb-6" aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1">
          <li><Link href="/" className="hover:text-ink">Home</Link> ›</li>
          {product.category && (
            <li><Link href={`/category/${product.category.slug}`} className="hover:text-ink">{product.category.name}</Link> ›</li>
          )}
          <li aria-current="page" className="line-clamp-1 text-ink">{product.name}</li>
        </ol>
      </nav>

      <VariantImageProvider>
        {/* minmax(0, …) columns: the thumbnail strip scrolls instead of widening the page. */}
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:gap-8 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <Gallery images={product.images} name={product.name} badge={percentOff > 0 ? `-${percentOff}%` : null} />

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
              header={header}
              details={details}
              delivery={delivery || null}
              shopPhone={settings.phone}
              returnDays={settings.return_policy_days}
              shareUrl={productUrl}
            />
          ) : (
            <div className="space-y-6">
              {header}
              <p className="card p-4 text-muted">This product is not available right now.</p>
              {details}
            </div>
          )}
        </div>
      </VariantImageProvider>

      {related.length > 0 && (
        <section className="mt-14 border-t border-line pt-8">
          <h2 className="section-title mb-5">Products related to this item</h2>
          <ProductGrid products={related} />
        </section>
      )}
    </div>
  );
}
