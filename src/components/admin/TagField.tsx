'use client';

import { useMemo, useState } from 'react';
import { cleanTag, MAX_TAGS, tagHref } from '@/lib/tags';

/**
 * Tags for a product (like Shopify): type a word and press Enter or comma. Tags
 * already used on other products are suggested, so one collection keeps one spelling.
 * Every tag is also a collection on the website (/collections/…).
 */
export function TagField({ initial, suggestions }: { initial: string[]; suggestions: string[] }) {
  const [tags, setTags] = useState(initial);
  const [text, setText] = useState('');
  const [bad, setBad] = useState(false);

  const add = (raw: string) => {
    const t = cleanTag(raw);
    if (!t) { if (raw.trim()) setBad(true); return; }
    // An existing tag with another spelling ("eid sale") keeps the existing one.
    const known = suggestions.find((s) => s.toLowerCase() === t.toLowerCase()) ?? t;
    setTags((cur) => (cur.some((c) => c.toLowerCase() === known.toLowerCase()) || cur.length >= MAX_TAGS ? cur : [...cur, known]));
    setText('');
    setBad(false);
  };
  const remove = (t: string) => setTags((cur) => cur.filter((c) => c !== t));

  const open = useMemo(() => {
    const q = text.trim().toLowerCase();
    return suggestions.filter((s) => !tags.some((t) => t.toLowerCase() === s.toLowerCase()) && (!q || s.toLowerCase().includes(q))).slice(0, 8);
  }, [text, suggestions, tags]);

  return (
    <div className="field">
      <label htmlFor="tag-input" className="label">Tags</label>
      <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-xl border border-line bg-white px-2 py-1.5 focus-within:border-brand">
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-tint py-0.5 pl-2.5 pr-1 text-[12.5px] font-semibold text-brand">
            {t}
            <button type="button" onClick={() => remove(t)} aria-label={`Remove tag ${t}`} className="grid h-5 w-5 place-items-center rounded-full hover:bg-brand hover:text-white">×</button>
          </span>
        ))}
        <input
          id="tag-input"
          value={text}
          onChange={(e) => { setText(e.target.value.replace(',', '')); setBad(false); if (e.target.value.includes(',')) add(e.target.value.replace(',', '')); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); add(text); }
            else if (e.key === 'Backspace' && !text && tags.length) remove(tags[tags.length - 1]!);
          }}
          onBlur={() => text.trim() && add(text)}
          placeholder={tags.length ? '' : 'e.g. Eid Sale, Best seller'}
          maxLength={40}
          disabled={tags.length >= MAX_TAGS}
          className="min-w-32 flex-1 bg-transparent py-1 text-[14px] outline-none"
        />
      </div>
      {open.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[12px] text-muted">Used before:</span>
          {open.map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="rounded-full border border-line px-2 py-0.5 text-[12px] hover:border-brand hover:text-brand">+ {s}</button>
          ))}
        </div>
      )}
      <p className={`hint ${bad ? 'text-bad' : ''}`}>
        {bad
          ? 'Use letters, numbers and spaces only (up to 40 characters).'
          : <>Press Enter after each tag. Each tag is a collection on the website{tags[0] ? <>, e.g. <a href={tagHref(tags[0])} target="_blank" rel="noreferrer" className="underline">{tagHref(tags[0])}</a></> : ''}.</>}
      </p>
      <input type="hidden" name="tags" value={tags.join(',')} />
    </div>
  );
}
