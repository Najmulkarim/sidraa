'use client';

import { useState } from 'react';

type Mode = 'sold_out' | 'preorder' | 'continue';

const OPTIONS: { value: Mode; title: string; text: string }[] = [
  { value: 'sold_out', title: 'Show “Sold out”', text: 'Customers cannot order it until you add stock.' },
  { value: 'preorder', title: 'Take pre-orders', text: 'Shows a Pre-order button and when you will deliver.' },
  { value: 'continue', title: 'Sale ongoing', text: 'Keeps selling as if in stock — no tag. Stock goes below zero and comes back when you restock.' },
];

/** Product form: what happens when this product runs out. Posts stockOutMode and preorderDays. */
export function StockOutFields({ mode, days, error }: { mode: Mode; days: number | null; error?: React.ReactNode }) {
  const [m, setM] = useState<Mode>(mode);
  return (
    <fieldset className="space-y-2">
      <legend className="label">When it runs out</legend>
      {OPTIONS.map((o) => (
        <label key={o.value} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${m === o.value ? 'border-brand bg-brand/5' : 'border-line'}`}>
          <input type="radio" name="stockOutMode" value={o.value} checked={m === o.value} onChange={() => setM(o.value)} className="mt-0.5 h-4 w-4 accent-[var(--brand)]" />
          <span>
            <b className="block text-sm">{o.title}</b>
            <span className="text-[12.5px] text-muted">{o.text}</span>
          </span>
        </label>
      ))}
      {m === 'preorder' && (
        <div className="field max-w-xs">
          <label htmlFor="preorderDays" className="label">Delivery in how many days?</label>
          <input id="preorderDays" name="preorderDays" type="number" min={1} max={180} defaultValue={days ?? 7} className="input" />
          {error}
        </div>
      )}
    </fieldset>
  );
}
