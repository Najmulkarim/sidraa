'use client';

import { useEffect, useRef, useState } from 'react';
import { saveCategory } from '@/actions/admin-catalog';
import { slugify } from '@/lib/slug';
import type { Category } from '@/lib/types';
import { FieldError, FormMessage, PendingButton, useKeepValuesAction } from './ui';

export function CategoryForm({ category }: { category?: Category }) {
  const { state, onSubmit, pending } = useKeepValuesAction(saveCategory);
  const [slug, setSlug] = useState(category?.slug ?? '');
  const [touched, setTouched] = useState(!!category);
  const formRef = useRef<HTMLFormElement>(null);
  // The "add" form clears itself after a successful save.
  useEffect(() => {
    if (state.ok && !category) {
      formRef.current?.reset();
      setSlug('');
      setTouched(false);
    }
  }, [state, category]);

  return (
    <form ref={formRef} onSubmit={onSubmit} className="grid gap-3 md:grid-cols-[1fr_1fr_1.4fr_6rem_auto_auto] md:items-end" noValidate>
      {category && <input type="hidden" name="id" value={category.id} />}
      <div className="field">
        <label className="label" htmlFor={`name-${category?.id ?? 'new'}`}>Name</label>
        <input id={`name-${category?.id ?? 'new'}`} name="name" defaultValue={category?.name} maxLength={80} required className="input" onChange={(e) => !touched && setSlug(slugify(e.target.value))} />
        <FieldError state={state} name="name" />
      </div>
      <div className="field">
        <label className="label" htmlFor={`slug-${category?.id ?? 'new'}`}>Web address</label>
        <input id={`slug-${category?.id ?? 'new'}`} name="slug" value={slug} onChange={(e) => { setSlug(e.target.value); setTouched(true); }} maxLength={80} required className="input" />
        <FieldError state={state} name="slug" />
      </div>
      <div className="field">
        <label className="label" htmlFor={`desc-${category?.id ?? 'new'}`}>Description</label>
        <input id={`desc-${category?.id ?? 'new'}`} name="description" defaultValue={category?.description ?? ''} maxLength={2000} className="input" />
      </div>
      <div className="field">
        <label className="label" htmlFor={`sort-${category?.id ?? 'new'}`}>Order</label>
        <input id={`sort-${category?.id ?? 'new'}`} name="sortOrder" type="number" defaultValue={category?.sort_order ?? 0} className="input" />
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="isPublic" defaultChecked={category?.is_public ?? true} className="h-4 w-4 accent-[var(--brand)]" />
        Visible
      </label>
      <PendingButton pending={pending} className="btn btn-primary btn-sm">{category ? 'Save' : 'Add'}</PendingButton>
      <div className="md:col-span-6"><FormMessage state={state} /></div>
    </form>
  );
}
