'use client';

import { useState } from 'react';
import type { Category } from '@/lib/types';

/** Mothers first, each with its children underneath. */
function tree(categories: Category[]): { mother: Category; children: Category[] }[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  return categories
    .filter((c) => !c.parent_id || !byId.has(c.parent_id))
    .map((mother) => ({ mother, children: categories.filter((c) => c.parent_id === mother.id) }));
}

/**
 * Tick every category the product belongs in; it shows in all of them alike.
 * (Stored as category_id = the first ticked, for the page path and Google,
 * and extra_category_ids = the rest; staff never see the difference.)
 */
export function CategoryFields({ categories, main: initialMain, extra: initialExtra }: { categories: Category[]; main: string; extra: string[] }) {
  const [picked, setPicked] = useState<string[]>(() => (initialMain ? [initialMain, ...initialExtra.filter((id) => id !== initialMain)] : []));
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const row = (c: Category, child: boolean) => (
    <label key={c.id} className={`flex min-h-8 cursor-pointer items-center gap-2.5 py-1 text-[14px] ${child ? 'pl-7' : ''}`}>
      <input type="checkbox" checked={picked.includes(c.id)} onChange={() => toggle(c.id)} className="h-4 w-4 accent-[var(--brand)]" />
      <span className={child ? 'text-ink/80' : 'font-semibold'}>{c.name}</span>
    </label>
  );

  return (
    <div className="field">
      <span className="label">Category</span>
      <div className="max-h-72 overflow-y-auto rounded-xl border border-line bg-white px-3 py-2" role="group" aria-label="Categories">
        {categories.length === 0 && <p className="py-1 text-sm text-muted">No categories yet — add them in Categories.</p>}
        {tree(categories).map(({ mother, children }) => (
          <div key={mother.id} className="py-0.5">
            {row(mother, false)}
            {children.map((c) => row(c, true))}
          </div>
        ))}
      </div>
      <p className="hint">
        {picked.length === 0 ? 'Tick one or more categories.' : `The product shows in ${picked.length === 1 ? 'this category' : `all ${picked.length} ticked categories`}.`}
      </p>
      <input type="hidden" name="categoryId" value={picked[0] ?? ''} />
      <input type="hidden" name="extraCategoryIds" value={picked.slice(1).join(',')} />
    </div>
  );
}
