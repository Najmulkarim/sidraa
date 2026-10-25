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
    <Link href="/cart" className="relative grid h-10 w-10 place-items-center rounded-full text-night transition hover:bg-white/70 hover:text-brand" aria-label={label} title="Cart">
      <Icon name="bag" size={21} />
      {ready && count > 0 && <CountBadge count={count} bump={bump} className="absolute right-0.5 top-0.5" />}
    </Link>
  );
}
