'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { duplicateOrder } from '@/actions/admin-orders';
import { Icon } from '../icons';
import { notify } from './Toaster';

/**
 * Makes a new order with the same customer and items, then opens it. It holds
 * stock, so the first click only arms the button; the second one creates.
 */
export function DuplicateOrderButton({ id, publicRef, icon = false }: { id: string; publicRef: string; icon?: boolean }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  function click() {
    if (!armed) return setArmed(true);
    setArmed(false);
    start(async () => {
      const r = await duplicateOrder(id);
      notify(r.ok, r.message);
      if (r.ok && r.values?.orderId) router.push(`/admin/orders/${r.values.orderId}`);
    });
  }

  const title = armed ? 'Click again to create the duplicate' : `Duplicate ${publicRef}`;
  if (icon) {
    return (
      <button type="button" title={title} aria-label={title} disabled={pending} onClick={click} className={`grid h-8 w-8 place-items-center rounded-lg border disabled:opacity-30 ${armed ? 'border-brand bg-brand text-white' : 'border-line text-ink hover:border-brand hover:text-brand'}`}>
        <Icon name="copy" size={16} />
      </button>
    );
  }
  return (
    <button type="button" title={title} disabled={pending} onClick={click} className={`btn btn-sm ${armed ? 'btn-primary' : 'btn-outline'}`}>
      <Icon name="copy" size={15} /> {pending ? 'Creating…' : armed ? 'Click again to confirm' : 'Duplicate order'}
    </button>
  );
}
