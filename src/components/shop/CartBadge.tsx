'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../icons';
import { useCart } from './CartProvider';

/** Changes every time the cart count goes up, so a badge keyed on it replays its pop. */
export function useCartBump() {
  const { count, ready } = useCart();
  const [bump, setBump] = useState(0);
  const prev = useRef(count);
  useEffect(() => {
    if (ready && count > prev.current) setBump((b) => b + 1);
    prev.current = count;
  }, [count, ready]);
  return bump;
}

export function CountBadge({ count, bump, className = '' }: { count: number; bump: number; className?: string }) {
  return (
    <span
      key={bump}
      className={`min-w-[18px] rounded-full bg-brand px-1 text-center text-[10px] font-bold leading-[18px] text-white ${bump ? 'animate-[pop_0.45s_ease-out]' : ''} ${className}`}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

export function CartBadge() {
  const { count, ready } = useCart();
  const bump = useCartBump();
  const label = ready && count > 0 ? `Cart, ${count} item${count === 1 ? '' : 's'}` : 'Cart';
  return (
    <Link href="/cart" className="relative flex flex-col items-center gap-0.5 px-1 text-ink hover:text-brand" aria-label={label}>
      <Icon name="bag" size={23} />
      <span className="hidden text-[11px] text-muted sm:block">Cart</span>
      {ready && count > 0 && <CountBadge count={count} bump={bump} className="absolute -right-1 -top-1.5" />}
    </Link>
  );
}
