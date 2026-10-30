'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { MAX_QTY } from '@/lib/cart';
import { trackPixel } from '@/lib/facebook/pixel';
import { formatTaka } from '@/lib/format';
import { whatsappOrderLink } from '@/lib/product-content';
import { canPick, exists, findVariant, initialSelection, optionGroups, type OptionKey, type OptionLabels, type PickVariant, type Selection } from '@/lib/variations';
import { Icon } from '../icons';
import { useCart } from './CartProvider';
import { ProductImage } from './ProductImage';
import { useVariantImage } from './VariantImage';

export type PickerVariant = PickVariant;

/**
 * The product page's right-hand side, Amazon style: title and price, the
 * colour / size / third-option pickers and the details on the left, a buy
 * box (stock, quantity, Add to cart, Buy now, WhatsApp, share) on the
 * right. On phones it stacks: pickers, buy box, then details. Each option
 * type is its own row; a colour with a photo shows as a photo swatch and
 * switches the gallery. Stock labels are a convenience; place_order()
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
  keepOrder = false,
  header,
  details,
  delivery,
  shopPhone = null,
  returnDays,
  shareUrl,
  preorderDays = null,
}: {
  productId: string;
  productName: string;
  productSlug: string;
  imagePath: string | null;
  compareAt: number | null;
  variants: PickerVariant[];
  labels: OptionLabels;
  imageOrder?: string[];
  /** The admin arranged the variations by hand: options stay in that order. */
  keepOrder?: boolean;
  /** Category, title and the like, shown above the price. */
  header?: ReactNode;
  /** "About this item", product details table, description. */
  details?: ReactNode;
  /** Delivery line(s) for the buy box. */
  delivery?: ReactNode;
  shopPhone?: string | null;
  returnDays: number;
  shareUrl: string;
  /** Set when the product takes pre-orders: out-of-stock options stay buyable, delivered in this many days. */
  preorderDays?: number | null;
}) {
  const { dispatch } = useCart();
  const router = useRouter();
  const { setImage } = useVariantImage();
  const groups = useMemo(() => optionGroups(variants, labels, imageOrder, keepOrder), [variants, labels, imageOrder, keepOrder]);
  const [sel, setSel] = useState<Selection>(() => initialSelection(variants, groups));
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Phones: once the buttons scroll off the top, a buy bar takes the bottom of the screen.
  const top = useRef<HTMLDivElement>(null);
  const buttons = useRef<HTMLDivElement>(null);
  const [barVisible, setBarVisible] = useState(false);
  const [toast, setToast] = useState(0);

  // A scroll check rather than an IntersectionObserver: a fast fling or a
  // jump can carry the buttons past the screen without ever intersecting.
  useEffect(() => {
    let frame = 0;
    const check = () => {
      frame = 0;
      const el = buttons.current;
      if (el) setBarVisible(el.getBoundingClientRect().bottom < 0);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    check();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(0), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const selected = groups.length === 0 ? (variants[0] ?? null) : findVariant(variants, groups, sel);
  const preorder = preorderDays !== null;
  const buyable = (v: PickerVariant) => v.stock > 0 || preorder;
  const allSoldOut = !variants.some(buyable);
  const preorderNow = preorder && !!selected && selected.stock <= 0;
  const prices = variants.filter((v) => canPickAll(v, sel)).map((v) => v.price);
  const shownPrice = selected?.price ?? (prices.length ? Math.min(...prices) : Math.min(...variants.map((v) => v.price)));
  const maxQty = preorderNow ? MAX_QTY : Math.max(1, Math.min(MAX_QTY, selected?.stock ?? MAX_QTY));

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
    if (!buyable(selected)) {
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
    else {
      setAdded(true);
      setToast((n) => n + 1);
    }
  }

  /** From the buy bar: an unpicked option is up the page, so take the shopper there. */
  function addFromBar(goToCheckout: boolean) {
    if (!selected || !buyable(selected)) top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    add(goToCheckout);
  }

  const chosen = selected ? [selected.color, selected.size, selected.option3].filter(Boolean).join(' / ') : 'Choose your options';
  const onSale = compareAt !== null && compareAt > shownPrice;
  const percentOff = onSale ? Math.round((1 - shownPrice / compareAt!) * 100) : 0;
  const whatsapp = whatsappOrderLink(
    shopPhone,
    [`Hi! I want to order:`, `${productName}${selected && chosen ? ` (${chosen})` : ''} × ${qty}`, selected?.sku ? `SKU: ${selected.sku}` : null, `Price: ${formatTaka(shownPrice)}`, shareUrl].filter(Boolean).join('\n'),
  );
  const [shared, setShared] = useState(false);

  async function share() {
    try {
      // typeof check: older desktop browsers have no share sheet.
      if (typeof navigator.share === 'function') await navigator.share({ title: productName, url: shareUrl });
      else {
        await navigator.clipboard.writeText(shareUrl);
        setShared(true);
        setTimeout(() => setShared(false), 1800);
      }
    } catch {
      // Share sheet closed, or clipboard blocked: nothing to do.
    }
  }

  return (
    <div ref={top} className="grid min-w-0 scroll-mt-24 grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_17.5rem] xl:items-start">
      <div className="space-y-4 xl:col-start-1 xl:row-start-1">
        {header}
        <div className="border-y border-line py-4">
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {onSale && <span className="text-2xl font-light text-bad">-{percentOff}%</span>}
            <span className="text-[1.9rem] font-semibold leading-none">{formatTaka(shownPrice)}</span>
          </p>
          {onSale && (
            <p className="mt-1.5 text-[13px] text-muted">
              Regular price: <s>{formatTaka(compareAt)}</s> <span className="ml-1 font-semibold text-ok">You save {formatTaka(compareAt! - shownPrice)}</span>
            </p>
          )}
          <p className="mt-1.5 text-[13px] text-muted">Cash on delivery · Pay when it reaches you</p>
        </div>
      </div>

      <div className="space-y-5 xl:col-start-1 xl:row-start-2">
      {groups.map((g) => (
        <fieldset key={g.key} className="space-y-2.5">
          <legend className="label mb-2">
            {g.label}
            {sel[g.key] ? <span className="font-normal text-muted">: {sel[g.key]}</span> : null}
          </legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={g.label}>
            {g.values.map((o) => {
              const active = sel[g.key] === o.value;
              const anyStock = variants.some((v) => v[g.key] === o.value && buyable(v));
              const available = canPick(variants, sel, g.key, o.value);
              const struck = !anyStock || (exists(variants, sel, g.key, o.value) && !available);
              const base = `rounded-xl border-[1.5px] text-sm font-semibold transition ${active ? 'border-brand ring-2 ring-brand/25' : 'border-line hover:border-ink'} ${!anyStock ? 'cursor-not-allowed opacity-50' : ''}`;
              return o.image ? (
                <button key={o.value} type="button" role="radio" aria-checked={active} aria-label={`${o.value}${struck ? ' (sold out)' : ''}`} title={o.value} disabled={!anyStock} onClick={() => pick(g.key, o.value)} className={`${base} w-[4.5rem] overflow-hidden bg-card p-1 text-center`}>
                  <span className="relative block aspect-[4/5] overflow-hidden rounded-lg bg-tint"><ProductImage path={o.image} alt="" sizes="72px" /></span>
                  <span className={`mt-1 block truncate text-[12px] ${struck ? 'text-muted line-through' : ''}`}>{o.value}</span>
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

      </div>

      {/* Buy box: right column on wide screens, after the pickers on phones. */}
      <aside aria-label="Buy" className="card space-y-4 p-4 xl:sticky xl:top-24 xl:col-start-2 xl:row-span-3 xl:row-start-1">
        <p className="text-2xl font-semibold leading-none">{formatTaka(shownPrice)}</p>
        {delivery && <div className="text-[13px] leading-relaxed text-ink/80">{delivery}</div>}
        <div className="space-y-1">
          {selected ? (
            preorderNow ? (
              <p className="text-[15px] font-semibold text-plum">Pre-order · delivery in {preorderDays} day{preorderDays === 1 ? '' : 's'}</p>
            ) : (
            <p className={`text-[15px] font-semibold ${selected.stock <= 0 ? 'text-bad' : selected.stock <= 3 ? 'text-warn' : 'text-ok'}`}>
              {selected.stock <= 0 ? 'Sold out' : selected.stock <= 3 ? `Only ${selected.stock} left — order soon` : 'In stock'}
            </p>
            )
          ) : (
            <p className="text-[13px] text-muted">{allSoldOut ? 'Sold out' : 'Choose your options to see stock'}</p>
          )}
          {selected?.sku && (
            <p className="text-[13px] text-muted">
              SKU: <span className="font-mono font-semibold text-ink">{selected.sku}</span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="label">Quantity</span>
          <div className="flex items-center rounded-full border border-line bg-card">
            <button type="button" className="h-10 w-10 text-lg" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">−</button>
            <span className="w-8 text-center font-semibold" aria-live="polite">{qty}</span>
            <button type="button" className="h-10 w-10 text-lg" onClick={() => setQty((q) => Math.min(maxQty, q + 1))} aria-label="Increase quantity">+</button>
          </div>
        </div>

        {error && <p className="error" role="alert">{error}</p>}

        <div ref={buttons} className="grid gap-2.5">
          <button type="button" className="btn btn-outline w-full" onClick={() => add(false)} disabled={allSoldOut}>
            {allSoldOut ? 'Sold out' : preorderNow ? 'Pre-order now' : 'Add to cart'}
          </button>
          <button type="button" className="btn btn-primary w-full" onClick={() => add(true)} disabled={allSoldOut}>
            {preorderNow ? 'Pre-order & checkout' : 'Buy now'}
          </button>
          {whatsapp && !allSoldOut && (
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="btn w-full bg-[#1fa855] text-white hover:bg-[#178c46]">
              <Icon name="whatsapp" size={18} /> Order on WhatsApp
            </a>
          )}
        </div>

        {added && (
          <p className="rounded-xl bg-ok/10 px-3 py-2.5 text-sm text-ok" role="status">
            Added to your cart. <Link href="/cart" className="font-semibold underline">View cart</Link>
          </p>
        )}

        <ul className="space-y-2 border-t border-line pt-3 text-[13px] text-ink/80">
          <li className="flex items-center gap-2"><Icon name="cash" size={17} className="shrink-0 text-brand" /> Cash on delivery</li>
          <li className="flex items-center gap-2"><Icon name="eye" size={17} className="shrink-0 text-brand" /> Check the parcel before you pay</li>
          <li className="flex items-center gap-2">
            <Icon name="return" size={17} className="shrink-0 text-brand" />
            <span>{returnDays}-day easy returns · <Link href="/info/returns" className="underline">Policy</Link></span>
          </li>
          <li className="flex items-center gap-2"><Icon name="shield" size={17} className="shrink-0 text-brand" /> Secure order, no account needed</li>
        </ul>

        <button type="button" onClick={share} className="flex w-full items-center justify-center gap-2 rounded-lg border border-line py-2 text-[13px] font-semibold hover:border-brand hover:text-brand">
          <Icon name={shared ? 'check' : 'share'} size={16} /> {shared ? 'Link copied' : 'Share this product'}
        </button>
      </aside>

      {details && <div className="min-w-0 space-y-8 xl:col-start-1 xl:row-start-3">{details}</div>}

      {/* Phone-only: toast + buy bar fixed to the bottom of the screen. */}
      {toast > 0 && (
        <div key={toast} className="fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 flex animate-[sheet-up_0.35s_cubic-bezier(0.2,0.8,0.2,1)] items-center gap-3 rounded-2xl bg-night px-4 py-3 text-sm text-white shadow-2xl md:hidden" aria-hidden="true">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ok"><Icon name="check" size={16} /></span>
          <span className="flex-1">Added to your cart</span>
          <Link href="/cart" className="font-semibold text-accent">View cart</Link>
        </div>
      )}
      {!allSoldOut && (
        <div
          className={`fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-10px_30px_-18px_var(--plum)] backdrop-blur transition-transform duration-300 md:hidden ${barVisible ? '' : 'pointer-events-none translate-y-[115%]'}`}
          aria-hidden={!barVisible}
        >
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[17px] font-semibold leading-tight">{formatTaka(shownPrice)}</p>
              <p className="truncate text-[12px] text-muted">{chosen}</p>
            </div>
            <button type="button" tabIndex={barVisible ? 0 : -1} className="btn btn-outline btn-sm h-11 px-3" onClick={() => addFromBar(false)} aria-label="Add to cart">
              <Icon name="bag" size={18} />
            </button>
            <button type="button" tabIndex={barVisible ? 0 : -1} className="btn btn-primary h-11 px-5" onClick={() => addFromBar(true)}>
              Buy now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function canPickAll(v: PickVariant, sel: Selection) {
  return (['color', 'size', 'option3'] as const).every((k) => sel[k] === undefined || v[k] === sel[k]);
}
