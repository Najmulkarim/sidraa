'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react';
import { CART_STORAGE_KEY, cartCount, cartReducer, parseCart, type CartAction, type CartLine } from '@/lib/cart';

type CartContextValue = {
  lines: CartLine[];
  count: number;
  ready: boolean; // false until localStorage has been read (avoids a flash of "empty cart")
  dispatch: (action: CartAction) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function readStorage(): CartLine[] {
  try {
    return parseCart(window.localStorage.getItem(CART_STORAGE_KEY));
  } catch {
    return [];
  }
}

function writeStorage(lines: CartLine[]) {
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(lines));
  } catch {
    // Private mode or storage full: the cart still works for this page view.
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, rawDispatch] = useReducer(cartReducer, []);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    rawDispatch({ type: 'replace', lines: readStorage() });
    setReady(true);
    // Keep several open tabs in step.
    const onStorage = (e: StorageEvent) => {
      if (e.key === CART_STORAGE_KEY) rawDispatch({ type: 'replace', lines: parseCart(e.newValue) });
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (ready) writeStorage(lines);
  }, [lines, ready]);

  const dispatch = useCallback((action: CartAction) => rawDispatch(action), []);
  const value = useMemo(() => ({ lines, count: cartCount(lines), ready, dispatch }), [lines, ready, dispatch]);

  return <CartContext value={value}>{children}</CartContext>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}
