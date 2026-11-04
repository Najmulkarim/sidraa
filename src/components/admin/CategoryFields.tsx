'use client';

import { useState } from 'react';
import type { Category } from '@/lib/types';

/**
 * The product's main category (breadcrumbs, Google, Facebook catalogue) and
 * any other categories it should also show in. Tap a name to add or remove it.
 */
export function CategoryFields({ categories, main: initialMain, extra: initialExtra }: { categories: Category[]; main: string; extra: string[] }) {
  const [main, setMain] = useState(initialMain);
  const [extra, setExtra] = useState<string[]>(initialExtra.filter((id) => id !== initialMain));
  const others = categories.filter((c) => c.id !== main);
  const toggle = (id: string) => setExtra((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]));

  return (
    <>
      <div className="field">
        <label htmlFor="categoryId" className="label">Main category</label>
        <select
          id="categoryId"
          name="categoryId"
          value={main}
          onChange={(e) => { const v = e.target.value; setMain(v); setExtra((x) => x.filter((id) => id !== v)); }}
          className="input"
        >
          <option value="">None</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      {main && others.length > 0 && (
        <div className="field">
          <span className="label">Also show in <span className="font-normal text-muted">(optional)</span></span>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Also show in these categories">
            {others.map((c) => {
              const on = extra.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(c.id)}
                  className={`rounded-full border px-3 py-1.5 text-[13px] font-medium transition ${on ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink/75 hover:border-brand hover:text-brand'}`}
                >
                  {on ? '✓ ' : '+ '}{c.name}
                </button>
              );
            })}
          </div>
          <p className="hint">The product also shows on these category pages.</p>
        </div>
      )}
      <input type="hidden" name="extraCategoryIds" value={main ? extra.join(',') : ''} />
    </>
  );
}
