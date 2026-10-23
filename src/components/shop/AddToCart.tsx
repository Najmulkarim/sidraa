'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { MAX_QTY } from '@/lib/cart';
import { trackPixel } from '@/lib/facebook/pixel';
import { formatTaka } from '@/lib/format';
import { canPick, exists, findVariant, initialSelection, optionGroups, type OptionKey, type OptionLabels, type PickVariant, type Selection } from '@/lib/variations';
import { useCart } from './CartProvider';
import { ProductImage } from './ProductImage';
import { useVariantImage } from './VariantImage';

export type PickerVariant = PickVariant;

/**
 * Colour / size / third-option pickers + quantity + Add to cart / Buy now.
 * Each type is its own row; a colour with a photo shows as a photo swatch
 * and switches the gallery. Stock labels are a convenience; place_order()
 * re-checks stock under a row lock.
 */
export function AddToCart({
  productId,
  productName,
  productSlug,
  imagePath,
  compareAt,
  variants,
  labels,
  imageOrder = [],
}: {
  productId: string;
  productName: string;
  productSlug: string;
  imagePath: string | null;
  compareAt: number | null;
  variants: PickerVariant[];
  labels: OptionLabels;
  imageOrder?: string[];
}) {
  const { dispatch } = useCart();
  const router = useRouter();
  const { setImage } = useVariantImage();
  const groups = useMemo(() => optionGroups(variants, labels, imageOrder), [variants, labels, imageOrder]);
  const [sel, setSel] = useState<Selection>(() => initialSelection(variants, groups));
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = groups.length === 0 ? (variants[0] ?? null) : findVariant(variants, groups, sel);
  const allSoldOut = !variants.some((v) => v.stock > 0);
  const prices = variants.filter((v) => canPickAll(v, sel)).map((v) => v.price);
  const shownPrice = selected?.price ?? (prices.length ? Math.min(...prices) : Math.min(...variants.map((v) => v.price)));
  const maxQty = Math.max(1, Math.min(MAX_QTY, selected?.stock ?? MAX_QTY));

  // Facebook Pixel (no-op without a Pixel ID). Content id = product id, as in the catalog feed.
  useEffect(() => {
    trackPixel('ViewContent', { content_ids: [productId], content_type: 'product', content_name: productName, value: Math.min(...variants.map((v) => v.price)) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  // The chosen colour's photo goes to the gallery.
  const colorImage = sel.color ? groups.find((g) => g.key === 'color')?.values.find((v) => v.value === sel.color)?.image ?? null : null;
  useEffect(() => {
    setImage(selected?.image_path ?? colorImage);
  }, [selected?.image_path, colorImage, setImage]);

  function pick(key: OptionKey, value: string) {
    setSel((cur) => {
      const next: Selection = { ...cur, [key]: value };
      if (variants.some((v) => canPickAll(v, next))) return next;
      // That combination does not exist: keep this choice and drop the ones that clash.
      const kept: Selection = { [key]: value };
      for (const g of groups) {
        const prev = cur[g.key];
        if (g.key !== key && prev !== undefined && variants.some((v) => canPickAll(v, { ...kept, [g.key]: prev }))) kept[g.key] = prev;
      }
      return kept;
    });
    setQty(1);
    setError(null);
    setAdded(false);
  }

  function add(goToCheckout: boolean) {
    if (!selected) {
      const missing = groups.find((g) => sel[g.key] === undefined);
      setError(`Choose a ${missing ? missing.label.toLowerCase() : 'option'} first.`);
      return;
    }
    if (selected.stock <= 0) {
      setError('This option is sold out.');
      return;
    }
    const label = [selected.color, selected.size, selected.option3].filter(Boolean).join(' / ');
    dispatch({
      type: 'add',
      line: { variantId: selected.id, quantity: qty, productName, productSlug, variantLabel: label, imagePath: selected.image_path ?? imagePath },
    });
    setError(null);
    trackPixel('AddToCart', { content_ids: [productId], content_type: 'product', content_name: productName, value: selected.price * qty, contents: [{ id: productId, quantity: qty, item_price: selected.price }] });
    if (goToCheckout) router.push('/checkout');
    else setAdded(true);
  }

  return (
    <div className="space-y-6">
      <p className="flex items-baseline gap-3">
        <span className="text-2xl font-semibold">{formatTaka(shownPrice)}</span>
        {compareAt !== null && compareAt > shownPrice && (
          <>
            <s className="text-muted">{formatTaka(compareAt)}</s>
            <span className="badge badge-brand">Save {formatTaka(compareAt - shownPrice)}</span>
          </>
        )}
      </p>

      {groups.map((g) => (
        <fieldset key={g.key} className="space-y-2.5">
          <legend className="label mb-2">
            {g.label}
            {sel[g.key] ? <span className="font-normal text-muted">: {sel[g.key]}</span> : null}
          </legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={g.label}>
            {g.values.map((o) => {
              const active = sel[g.key] === o.value;
              const anyStock = variants.some((v) => v[g.key] === o.value && v.stock > 0);
              const available = canPick(variants, sel, g.key, o.value);
              const struck = !anyStock || (exists(variants, sel, g.key, o.value) && !available);
              const base = `rounded-xl border-[1.5px] text-sm font-semibold transition ${active ? 'border-brand ring-2 ring-brand/25' : 'border-line hover:border-ink'} ${!anyStock ? 'cursor-not-allowed opacity-50' : ''}`;
              return o.image ? (
                <button key={o.value} type="button" role="radio" aria-checked={active} aria-label={`${o.value}${struck ? ' (sold out)' : ''}`} title={o.value} disabled={!anyStock} onClick={() => pick(g.key, o.value)} className={`${base} w-[4.5rem] overflow-hidden bg-card p-1 text-center`}>
                  <span className="relative block aspect-[4/5] overflow-hidden rounded-lg bg-tint"><ProductImage path={o.image} alt="" sizes="72px" /></span>
                  <span className={`mt-1 block truncate text-[11.5px] ${struck ? 'text-muted line-through' : ''}`}>{o.value}</span>
                </button>
              ) : (
                <button key={o.value} type="button" role="radio" aria-checked={active} aria-label={`${o.value}${struck ? ' (sold out)' : ''}`} disabled={!anyStock} onClick={() => pick(g.key, o.value)} className={`${base} min-h-11 min-w-14 px-4 ${active ? 'bg-brand text-white' : 'bg-card'} ${struck && !active ? 'text-muted line-through' : ''}`}>
                  {o.value}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}

      {selected && (
        <p className={`text-sm ${selected.stock <= 3 ? 'text-warn' : 'text-ok'}`}>
          {selected.stock <= 0 ? 'Sold out' : selected.stock <= 3 ? `Only ${selected.stock} left` : 'In stock'}
        </p>
      )}

      <div className="flex items-center gap-3">
        <span className="label">Quantity</span>
        <div className="flex items-center rounded-full border border-line bg-card">
          <button type="button" className="h-11 w-11 text-lg" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">−</button>
          <span className="w-8 text-center font-semibold" aria-live="polite">{qty}</span>
          <button type="button" className="h-11 w-11 text-lg" onClick={() => setQty((q) => Math.min(maxQty, q + 1))} aria-label="Increase quantity">+</button>
        </div>
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" className="btn btn-outline" onClick={() => add(false)} disabled={allSoldOut}>
          {allSoldOut ? 'Sold out' : 'Add to cart'}
        </button>
        <button type="button" className="btn btn-primary" onClick={() => add(true)} disabled={allSoldOut}>
          Buy now — cash on delivery
        </button>
      </div>

      {added && (
        <p className="rounded-xl bg-ok/10 px-4 py-3 text-sm text-ok" role="status">
          Added to your cart. <Link href="/cart" className="font-semibold underline">View cart</Link>
        </p>
      )}
    </div>
  );
}

function canPickAll(v: PickVariant, sel: Selection) {
  return (['color', 'size', 'option3'] as const).every((k) => sel[k] === undefined || v[k] === sel[k]);
}
