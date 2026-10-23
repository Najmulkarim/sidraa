'use client';

import { useEffect } from 'react';
import { useCart } from './CartProvider';

/** Empties the cart once the order confirmation has rendered. */
export function ClearCart() {
  const { dispatch, ready } = useCart();
  useEffect(() => {
    if (ready) dispatch({ type: 'clear' });
  }, [ready, dispatch]);
  return null;
}
