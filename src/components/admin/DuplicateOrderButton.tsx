'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { duplicateOrder } from '@/actions/admin-orders';
import { Icon } from '../icons';
import { notify } from './Toaster';

/** Asks first (a new order holds stock), makes a new order with the same customer and items, then opens it. */
export function DuplicateOrderButton({ id, publicRef, icon = false }: { id: string; publicRef: string; icon?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function click() {
    if (!window.confirm(`Create a new order with the same customer and items as ${publicRef}?`)) return;
    start(async () => {
      try {
        const r = await duplicateOrder(id);
        notify(r.ok, r.message);
        if (r.ok && r.values?.orderId) router.push(`/admin/orders/${r.values.orderId}`);
      } catch (e) {
        console.error('[admin] duplicate order', e);
        notify(false, 'Could not duplicate the order. Reload the page and try again.');
      }
    });
  }

  const title = `Duplicate ${publicRef}`;
  if (icon) {
    return (
      <button type="button" title={title} aria-label={title} aria-busy={pending} disabled={pending} onClick={click} className="grid h-8 w-8 place-items-center rounded-lg border border-line text-ink hover:border-brand hover:text-brand disabled:opacity-30">
        <Icon name="copy" size={16} />
      </button>
    );
  }
  return (
    <button type="button" title={title} disabled={pending} onClick={click} className="btn btn-outline btn-sm">
      <Icon name="copy" size={15} /> {pending ? 'Creating…' : 'Duplicate order'}
    </button>
  );
}
