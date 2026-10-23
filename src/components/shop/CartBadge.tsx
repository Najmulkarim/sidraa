'use client';

import Link from 'next/link';
import { Icon } from '../icons';
import { useCart } from './CartProvider';

export function CartBadge() {
  const { count, ready } = useCart();
  const label = ready && count > 0 ? `Cart, ${count} item${count === 1 ? '' : 's'}` : 'Cart';
  return (
    <Link href="/cart" className="relative flex flex-col items-center gap-0.5 px-1 text-ink hover:text-brand" aria-label={label}>
      <Icon name="bag" size={23} />
      <span className="hidden text-[11px] text-muted sm:block">Cart</span>
      {ready && count > 0 && (
        <span className="absolute -right-1 -top-1.5 min-w-[18px] rounded-full bg-brand px-1 text-center text-[10px] font-bold leading-[18px] text-white">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}
