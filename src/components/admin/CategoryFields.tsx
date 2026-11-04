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
 * Tick every category the product belongs in. The first one ticked is the
 * main category (breadcrumbs, Google, Facebook catalogue); the others are
 * "also show in". Any ticked one can be made the main one.
 */
export function CategoryFields({ categories, main: initialMain, extra: initialExtra }: { categories: Category[]; main: string; extra: string[] }) {
  // Ticked categories, the main one first.
  const [picked, setPicked] = useState<string[]>(() => (initialMain ? [initialMain, ...initialExtra.filter((id) => id !== initialMain)] : []));
  const main = picked[0] ?? '';
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const makeMain = (id: string) => setPicked((p) => [id, ...p.filter((x) => x !== id)]);

  const row = (c: Category, child: boolean) => {
    const on = picked.includes(c.id);
    return (
      <div key={c.id} className={`group flex min-h-8 items-center gap-2 ${child ? 'pl-7' : ''}`}>
        <label className="flex cursor-pointer items-center gap-2.5 py-1 text-[14px]">
          <input type="checkbox" checked={on} onChange={() => toggle(c.id)} className="h-4 w-4 accent-[var(--brand)]" />
          <span className={child ? 'text-ink/80' : 'font-semibold'}>{c.name}</span>
        </label>
        {on && c.id === main && <span className="rounded-full bg-brand px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-white">Main</span>}
        {on && c.id !== main && (
          <button type="button" onClick={() => makeMain(c.id)} className="text-[12px] font-semibold text-muted opacity-0 transition hover:text-brand group-hover:opacity-100 focus:opacity-100">
            Make main
          </button>
        )}
      </div>
    );
  };

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
        {picked.length === 0
          ? 'Tick one or more categories.'
          : picked.length === 1
            ? 'Tick more to show the product in other categories too.'
            : `Shows in ${picked.length} categories. The one marked Main is used for the product page path and Google.`}
      </p>
      <input type="hidden" name="categoryId" value={main} />
      <input type="hidden" name="extraCategoryIds" value={picked.slice(1).join(',')} />
    </div>
  );
}
