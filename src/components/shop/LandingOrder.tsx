'use client';

import { useEffect, useMemo, useState } from 'react';
import { MAX_QTY, type CartLine } from '@/lib/cart';
import { trackPixel } from '@/lib/facebook/pixel';
import { formatTaka } from '@/lib/format';
import { canPick, exists, findVariant, initialSelection, optionGroups, type OptionKey, type OptionLabels, type PickVariant, type Selection } from '@/lib/variations';
import type { PaymentOptions } from '@/lib/payments/settings';
import type { DeliveryZone } from '@/lib/types';
import { FixedCartProvider } from './CartProvider';
import { CheckoutForm } from './CheckoutForm';
import { ProductImage } from './ProductImage';
import { useVariantImage } from './VariantImage';

/**
 * The order block of a landing page: pick colour / size and quantity, then
 * the usual checkout form underneath (same prices, stock checks, coupon
 * rules and incomplete-order capture as the shop's checkout).
 */
export function LandingOrder({
  slug, productId, productName, productSlug, imagePath, variants, labels, imageOrder, keepOrder, preorder,
  coupon, buttonText, zones, codTerms, returnDays, payments,
}: {
  slug: string;
  productId: string;
  productName: string;
  productSlug: string;
  imagePath: string | null;
  variants: PickVariant[];
  labels: OptionLabels;
  imageOrder: string[];
  keepOrder: boolean;
  preorder: boolean;
  coupon: string | null;
  buttonText: string | null;
  zones: DeliveryZone[];
  codTerms: string;
  returnDays: number;
  payments: PaymentOptions;
}) {
  const { setImage } = useVariantImage();
  const groups = useMemo(() => optionGroups(variants, labels, imageOrder, keepOrder), [variants, labels, imageOrder, keepOrder]);
  const [sel, setSel] = useState<Selection>(() => initialSelection(variants, groups));
  const [qty, setQty] = useState(1);
  const selected = groups.length === 0 ? (variants[0] ?? null) : findVariant(variants, groups, sel);
  const buyable = (v: PickVariant) => v.stock > 0 || preorder;
  const maxQty = selected && !preorder ? Math.max(1, Math.min(MAX_QTY, selected.stock)) : MAX_QTY;

  useEffect(() => {
    trackPixel('ViewContent', { content_ids: [productId], content_type: 'product', content_name: productName, value: Math.min(...variants.map((v) => v.price)) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const colorImage = sel.color ? groups.find((g) => g.key === 'color')?.values.find((v) => v.value === sel.color)?.image ?? null : null;
  useEffect(() => { setImage(selected?.image_path ?? colorImage); }, [selected?.image_path, colorImage, setImage]);
  useEffect(() => { setQty((q) => Math.min(q, maxQty)); }, [maxQty]);

  function pick(key: OptionKey, value: string) {
    setSel((cur) => {
      const next: Selection = { ...cur, [key]: value };
      if (variants.some((v) => groups.every((g) => next[g.key] === undefined || v[g.key] === next[g.key]))) return next;
      return { [key]: value };
    });
  }

  const label = selected ? [selected.color, selected.size, selected.option3].filter(Boolean).join(' / ') : '';
  const lines: CartLine[] = useMemo(
    () => (selected && buyable(selected) ? [{ variantId: selected.id, quantity: qty, productName, productSlug, variantLabel: label, imagePath: selected.image_path ?? imagePath }] : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selected?.id, qty, label],
  );
  const missing = groups.find((g) => sel[g.key] === undefined);

  return (
    <div className="space-y-5">
      <section className="card space-y-5 p-5 sm:p-6">
        <h2 className="font-display text-2xl font-semibold">Choose your item</h2>
        <div className="flex items-center gap-3">
          <span className="relative h-20 w-16 shrink-0 overflow-hidden rounded-lg bg-tint"><ProductImage path={selected?.image_path ?? colorImage ?? imagePath} alt="" sizes="64px" /></span>
          <div className="min-w-0">
            <p className="font-semibold leading-snug">{productName}</p>
            {label && <p className="text-[13px] text-muted">{label}</p>}
            {selected && <p className="mt-0.5 font-semibold text-brand">{formatTaka(selected.price)}</p>}
          </div>
        </div>
        {groups.map((g) => (
          <fieldset key={g.key} className="space-y-2">
            <legend className="label mb-2">{g.label}{sel[g.key] ? <span className="font-normal text-muted">: {sel[g.key]}</span> : null}</legend>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={g.label}>
              {g.values.map((o) => {
                const active = sel[g.key] === o.value;
                const anyStock = variants.some((v) => v[g.key] === o.value && buyable(v));
                const struck = !anyStock || !exists(variants, sel, g.key, o.value) || !(preorder || canPick(variants, sel, g.key, o.value));
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={!anyStock}
                    onClick={() => pick(g.key, o.value)}
                    className={`flex items-center gap-2 rounded-xl border-[1.5px] px-3 py-2 text-sm font-semibold transition ${active ? 'border-brand bg-tint ring-2 ring-brand/25' : 'border-line hover:border-ink'} ${!anyStock ? 'cursor-not-allowed opacity-50' : ''}`}
                  >
                    {o.image && <span className="relative h-8 w-7 overflow-hidden rounded bg-tint"><ProductImage path={o.image} alt="" sizes="28px" /></span>}
                    <span className={struck && !active ? 'text-muted line-through' : ''}>{o.value}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
        <div className="flex items-center gap-3">
          <span className="label mb-0">Quantity</span>
          <div className="flex items-center rounded-full border border-line">
            <button type="button" className="h-10 w-10 text-lg" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">−</button>
            <span className="w-8 text-center font-semibold" aria-live="polite">{qty}</span>
            <button type="button" className="h-10 w-10 text-lg" onClick={() => setQty((q) => Math.min(maxQty, q + 1))} aria-label="Increase quantity">+</button>
          </div>
        </div>
        {selected && !buyable(selected) && <p className="error">This option is sold out. Please choose another.</p>}
      </section>

      <FixedCartProvider lines={lines}>
        <CheckoutForm
          zones={zones}
          codTerms={codTerms}
          returnDays={returnDays}
          payments={payments}
          landing={{ slug, coupon, buttonText, empty: missing ? `Choose a ${missing.label.toLowerCase()} above to order.` : 'Choose an option above to order.' }}
        />
      </FixedCartProvider>
    </div>
  );
}
