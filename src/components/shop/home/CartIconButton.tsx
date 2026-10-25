'use client';

import Link from 'next/link';
import { useState } from 'react';
import { trackPixel } from '@/lib/facebook/pixel';
import { Icon } from '../../icons';
import { useCart } from '../CartProvider';

type Props = {
  productId: string;
  productName: string;
  productSlug: string;
  imagePath: string | null;
  price: number;
  /** Set when the product has exactly one option: one tap adds it. Otherwise the button opens the product. */
  variantId: string | null;
  soldOut: boolean;
  look: 'icon' | 'wide';
};

/** Cart button on theme product cards. */
export function CartIconButton({ productId, productName, productSlug, imagePath, price, variantId, soldOut, look }: Props) {
  const { dispatch } = useCart();
  const [added, setAdded] = useState(false);
  const cls = look === 'icon'
    ? 'grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line bg-card text-night transition hover:border-night hover:bg-night hover:text-white'
    : 'flex h-9 w-full items-center justify-center gap-2 rounded-md border border-line text-[13px] font-medium text-night transition hover:border-night hover:bg-night hover:text-white';
  if (soldOut) return <span className={`${cls} cursor-not-allowed opacity-50`} aria-label="Sold out">{look === 'wide' ? 'Sold out' : <Icon name="ban" size={16} />}</span>;
  if (!variantId) {
    return (
      <Link href={`/product/${productSlug}`} className={cls} aria-label={`Choose options for ${productName}`}>
        <Icon name="cart" size={17} />{look === 'wide' && 'Choose options'}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className={cls}
      aria-label={`Add ${productName} to cart`}
      onClick={(e) => {
        e.preventDefault();
        dispatch({ type: 'add', line: { variantId, quantity: 1, productName, productSlug, variantLabel: '', imagePath } });
        trackPixel('AddToCart', { content_ids: [productId], content_type: 'product', content_name: productName, value: price, contents: [{ id: productId, quantity: 1, item_price: price }] });
        setAdded(true);
        setTimeout(() => setAdded(false), 1500);
      }}
    >
      <Icon name={added ? 'check' : 'cart'} size={17} />{look === 'wide' && (added ? 'Added' : 'Add to cart')}
    </button>
  );
}
