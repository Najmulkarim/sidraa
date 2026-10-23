'use client';

import { useState } from 'react';
import { trackPixel } from '@/lib/facebook/pixel';
import { useCart } from './CartProvider';

/** One-tap "Add to cart" on product cards, for products with a single option. */
export function QuickAdd({ productId, price, variantId, productName, productSlug, imagePath }: { productId: string; price: number; variantId: string; productName: string; productSlug: string; imagePath: string | null }) {
  const { dispatch } = useCart();
  const [added, setAdded] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-outline btn-sm w-full"
      onClick={() => {
        dispatch({ type: 'add', line: { variantId, quantity: 1, productName, productSlug, variantLabel: '', imagePath } });
        trackPixel('AddToCart', { content_ids: [productId], content_type: 'product', content_name: productName, value: price, contents: [{ id: productId, quantity: 1, item_price: price }] });
        setAdded(true);
        setTimeout(() => setAdded(false), 1600);
      }}
    >
      {added ? 'Added ✓' : 'Add to cart'}
    </button>
  );
}
