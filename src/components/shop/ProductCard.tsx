import Link from 'next/link';
import { formatTaka, toNumber } from '@/lib/format';
import { priceRange, totalStock, variantLabel } from '@/lib/catalog';
import type { ProductWithRelations } from '@/lib/types';
import { ProductImage } from './ProductImage';
import { QuickAdd } from './QuickAdd';

export function ProductCard({ product, priority = false, badge }: { product: ProductWithRelations; priority?: boolean; badge?: string }) {
  const { min, max } = priceRange(product);
  const compare = product.compare_at_price === null ? null : toNumber(product.compare_at_price);
  const soldOut = totalStock(product) <= 0;
  const image = product.images[0];
  const active = product.variants.filter((v) => v.is_active);
  const single = active.length === 1 && variantLabel(active[0]!) === '' ? active[0]! : null;
  const discount = compare !== null && compare > min ? Math.round((1 - min / compare) * 100) : 0;
  // Colour photos as small swatches under the name.
  const colors = [...new Map(active.filter((v) => v.color).map((v) => [v.color, v.image_path ?? null])).entries()];
  const hasColor = active.some((v) => v.color);
  const hasSize = active.some((v) => v.size);
  const choose = hasColor && hasSize ? 'Choose options' : hasColor ? 'Choose colour' : 'Choose size';

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-xl border border-line bg-card transition hover:-translate-y-0.5 hover:shadow-[var(--shadow)]">
      <Link href={`/product/${product.slug}`} className="relative block aspect-[4/5] overflow-hidden bg-tint">
        <ProductImage
          path={image?.storage_path}
          alt={image?.alt ?? product.name}
          sizes="(min-width: 1024px) 22vw, (min-width: 640px) 33vw, 50vw"
          priority={priority}
          className="transition duration-500 group-hover:scale-[1.04]"
        />
        <span className="absolute left-2 top-2 flex flex-col items-start gap-1">
          {soldOut ? (
            <span className="rounded-md bg-night px-2 py-0.5 text-[10.5px] font-bold uppercase text-white">Sold out</span>
          ) : discount > 0 ? (
            <span className="rounded-md bg-brand px-2 py-0.5 text-[10.5px] font-bold text-white">−{discount}%</span>
          ) : badge ? (
            <span className="rounded-md bg-plum px-2 py-0.5 text-[10.5px] font-bold uppercase text-white">{badge}</span>
          ) : null}
        </span>
      </Link>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <h3 className="line-clamp-1 text-[13.5px] font-medium">
          <Link href={`/product/${product.slug}`} className="hover:text-brand">{product.name}</Link>
        </h3>
        <p className="flex flex-wrap items-baseline gap-x-2 text-[13.5px]">
          <span className="font-semibold text-brand">
            {min !== max ? 'From ' : ''}
            {formatTaka(min)}
          </span>
          {discount > 0 && <s className="text-[12px] text-muted">{formatTaka(compare)}</s>}
        </p>
        {colors.length > 1 && (
          <p className="flex items-center gap-1" aria-label={`${colors.length} colours: ${colors.map(([c]) => c).join(', ')}`}>
            {colors.slice(0, 5).map(([c, img]) =>
              img ? (
                <span key={c} title={c} className="relative block h-5 w-5 overflow-hidden rounded-full border border-line bg-tint"><ProductImage path={img} alt="" sizes="20px" /></span>
              ) : (
                <span key={c} title={c} className="rounded-full border border-line px-1.5 text-[10px] text-muted">{c}</span>
              ),
            )}
            {colors.length > 5 && <span className="text-[11px] text-muted">+{colors.length - 5}</span>}
          </p>
        )}
        <div className="mt-auto pt-1.5">
          {soldOut ? (
            <span className="btn btn-sm w-full border border-line text-muted" aria-disabled="true">Sold out</span>
          ) : single ? (
            <QuickAdd productId={product.id} price={toNumber(single.price ?? product.base_price)} variantId={single.id} productName={product.name} productSlug={product.slug} imagePath={image?.storage_path ?? null} />
          ) : (
            <Link href={`/product/${product.slug}`} className="btn btn-outline btn-sm w-full">{choose}</Link>
          )}
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ products, priorityCount = 0, badge }: { products: ProductWithRelations[]; priorityCount?: number; badge?: string }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} priority={i < priorityCount} badge={badge} />
      ))}
    </div>
  );
}

/** One row that scrolls sideways on small screens and shows up to 5 cards on wide ones. */
export function ProductRow({ products, badge }: { products: ProductWithRelations[]; badge?: string }) {
  return (
    <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:thin] sm:gap-4 md:mx-0 md:px-0">
      {products.map((p) => (
        <div key={p.id} className="w-[46%] shrink-0 snap-start sm:w-[31%] lg:w-[calc((100%-4rem)/5)]">
          <ProductCard product={p} badge={badge} />
        </div>
      ))}
    </div>
  );
}
