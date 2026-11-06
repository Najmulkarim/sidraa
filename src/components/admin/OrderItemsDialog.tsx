'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { formatTaka } from '@/lib/format';
import { ProductImage } from '../shop/ProductImage';
import { Icon } from '../icons';
import type { OrderItemInfo } from './OrdersTable';

/** The order's product photos; clicking them opens each product's name, SKU, variation and price. */
export function OrderItemsDialog({ items, orderRef, children }: { items: OrderItemInfo[]; orderRef: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    // The page behind stays still while the list is open (phones scroll the page otherwise).
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open]);
  const count = items.reduce((n, i) => n + i.quantity, 0);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="group/items cursor-zoom-in text-left" title="See the products in this order">
        {children}
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-50 flex h-dvh w-screen items-center justify-center bg-night/50 p-3 backdrop-blur-sm sm:p-4" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Product information" className="flex max-h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3 border-b border-line px-5 py-4">
              <div>
                <h2 className="text-lg font-bold">Product information</h2>
                <p className="text-[12.5px] text-muted">{count} item{count === 1 ? '' : 's'} · <span className="font-mono">{orderRef}</span></p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" autoFocus className="ml-auto grid h-9 w-9 place-items-center rounded-full bg-soft text-muted hover:bg-line"><Icon name="x" size={16} /></button>
            </div>
            <ul className="min-h-0 space-y-2.5 overflow-y-auto overscroll-contain p-3 sm:space-y-3 sm:p-5">
              {items.map((i) => (
                <li key={i.id} className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3 rounded-xl border border-line bg-soft/50 p-2.5 sm:grid-cols-[13rem_minmax(0,1fr)] sm:gap-4 sm:p-4">
                  <span className="relative block aspect-square overflow-hidden rounded-lg bg-white">
                    <ProductImage path={i.image} alt={i.product_name} sizes="(min-width: 640px) 208px, 96px" />
                  </span>
                  <dl className="grid content-center gap-1.5 text-[13px] sm:gap-3 sm:text-[14px]">
                    <Row label="Name">{i.product_name}</Row>
                    <Row label="SKU"><span className="font-mono">{i.sku}</span></Row>
                    {i.variant_label && <Row label="Variation">{i.variant_label}</Row>}
                    <Row label="Price"><span className="font-mono">{formatTaka(i.unit_price)} × {i.quantity} = <b>{formatTaka(i.unit_price * i.quantity)}</b></span></Row>
                  </dl>
                </li>
              ))}
            </ul>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[10.5px] font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 break-words font-medium text-ink">{children}</dd>
    </div>
  );
}
