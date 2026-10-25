'use client';

import { useState } from 'react';
import { formatTaka } from '@/lib/format';

const num = (v: string) => {
  const n = Number(v.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && v.trim() !== '' ? n : null;
};

/**
 * Regular price + a discount in % or ৳; the selling price follows. Posts the
 * same fields as before (basePrice = selling price, compareAtPrice = regular
 * price) plus discountStyle, which decides how the badge reads in the shop.
 */
export function DiscountFields({ basePrice, compareAtPrice, style, errors }: {
  basePrice: number | null; compareAtPrice: number | null; style: 'percent' | 'amount'; errors: { basePrice?: React.ReactNode; compareAtPrice?: React.ReactNode };
}) {
  const hasDiscount = compareAtPrice !== null && basePrice !== null && compareAtPrice > basePrice;
  const [regular, setRegular] = useState(hasDiscount ? String(compareAtPrice) : basePrice === null ? '' : String(basePrice));
  const [type, setType] = useState<'percent' | 'amount'>(style);
  const [value, setValue] = useState(
    !hasDiscount ? '' : style === 'percent' ? String(Math.round((1 - basePrice! / compareAtPrice!) * 100)) : String(compareAtPrice! - basePrice!),
  );
  // Until the discount boxes are touched, keep the saved selling price exactly (a % can round).
  const [touched, setTouched] = useState(false);

  const r = num(regular);
  const d = num(value);
  let selling = r;
  if (r !== null && d !== null && d > 0) selling = type === 'percent' ? Math.round(r * (1 - Math.min(d, 99) / 100)) : Math.max(0, r - d);
  if (!touched && hasDiscount && r === compareAtPrice) selling = basePrice;
  const discounted = r !== null && selling !== null && selling < r;

  return (
    <div className="space-y-3">
      <div className="field">
        <label htmlFor="regularPrice" className="label">Regular price ৳</label>
        <input id="regularPrice" inputMode="decimal" required value={regular} onChange={(e) => { setRegular(e.target.value); setTouched(true); }} className="input" />
        {errors.basePrice}
      </div>
      <div className="field">
        <span className="label">Discount (optional)</span>
        <div className="flex gap-2">
          <select aria-label="Discount type" value={type} onChange={(e) => { setType(e.target.value as 'percent' | 'amount'); setTouched(true); }} className="input w-28 shrink-0">
            <option value="percent">% off</option>
            <option value="amount">৳ off</option>
          </select>
          <input aria-label="Discount amount" inputMode="decimal" value={value} onChange={(e) => { setValue(e.target.value); setTouched(true); }} placeholder={type === 'percent' ? 'e.g. 20' : 'e.g. 200'} className="input min-w-0 flex-1" />
        </div>
        {errors.compareAtPrice}
      </div>
      <p className="rounded-lg bg-soft px-3 py-2 text-[13px]">
        Selling price: <b>{selling === null ? '—' : formatTaka(selling)}</b>
        {discounted && (
          <span className="ml-2 rounded-md bg-brand px-1.5 py-0.5 text-[11px] font-bold text-white">
            {type === 'percent' ? `${Math.round((1 - selling! / r!) * 100)}% OFF` : `${formatTaka(r! - selling!)} OFF`}
          </span>
        )}
      </p>
      {/* What the server receives (unchanged field names). */}
      <input type="hidden" name="basePrice" value={selling ?? ''} />
      <input type="hidden" name="compareAtPrice" value={discounted ? String(r) : ''} />
      <input type="hidden" name="discountStyle" value={type} />
    </div>
  );
}
