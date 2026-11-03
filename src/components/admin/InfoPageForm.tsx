'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { saveInfoPage } from '@/actions/admin-storefront';
import { DescriptionEditor } from './DescriptionEditor';
import { FormMessage, PendingButton, useKeepValuesAction } from './ui';

/** One footer page (Delivery, Returns, Privacy, Terms): heading and text, edited the way it looks. */
export function InfoPageForm({ page, label, title, defaultTitle, body, custom, note }: {
  page: string;
  label: string;
  title: string;
  defaultTitle: string;
  body: string;
  custom: boolean;
  note?: string;
}) {
  const { state, onSubmit, pending } = useKeepValuesAction(saveInfoPage);
  const reset = useRef<HTMLInputElement>(null);
  return (
    <form onSubmit={onSubmit} className="card space-y-4 p-5">
      <input type="hidden" name="page" value={page} />
      <input ref={reset} type="hidden" name="reset" defaultValue="" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{label}</h2>
        <div className="flex items-center gap-3 text-[13px]">
          <span className={custom ? 'font-semibold text-ok' : 'text-muted'}>{custom ? 'Your own text' : 'Starter text'}</span>
          <Link href={`/info/${page}`} target="_blank" className="font-semibold text-brand hover:underline">View page ↗</Link>
        </div>
      </div>
      <div className="field">
        <label htmlFor={`title-${page}`} className="label">Page heading</label>
        <input id={`title-${page}`} name="title" defaultValue={title} placeholder={defaultTitle} maxLength={100} className="input" />
      </div>
      <div className="field">
        <span className="label">Text</span>
        {/* A new key after each save shows the saved text again. */}
        <DescriptionEditor key={body} defaultValue={body} placeholder="Write this page…" plain />
        <p className="hint">Select text, then press a button: <b>B</b> bold, <b>H1</b>/<b>H2</b> headings, or a list style. {note}</p>
      </div>
      <FormMessage state={state} />
      <div className="flex flex-wrap items-center gap-3">
        <span onClick={() => { if (reset.current) reset.current.value = ''; }}><PendingButton pending={pending}>Save</PendingButton></span>
        {custom && (
          <button
            type="submit"
            onClick={(e) => {
              if (!confirm('Go back to the starter text? Your own text on this page will be removed.')) e.preventDefault();
              else if (reset.current) reset.current.value = '1';
            }}
            className="btn btn-ghost text-[13px]"
          >
            Use starter text
          </button>
        )}
      </div>
    </form>
  );
}
