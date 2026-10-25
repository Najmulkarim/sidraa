'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { activateTheme } from '@/actions/admin-home';
import { THEME_INFO, THEMES, type ThemeKey } from '@/lib/home-sections';
import { Icon } from '../icons';
import { ProductImage } from '../shop/ProductImage';
import { notify } from './Toaster';

/** Theme cards: preview any theme, edit its sections, make it live in one click. */
export function ThemePicker({ live, editing, photos }: { live: ThemeKey; editing: ThemeKey; photos: string[] }) {
  const [current, setCurrent] = useState(live);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function activate(t: ThemeKey) {
    setMsg(null);
    start(async () => {
      const r = await activateTheme(t);
      if (r.ok) setCurrent(t);
      setMsg({ ok: r.ok, text: r.message ?? '' });
      notify(r.ok, r.message);
    });
  }

  return (
    <section className="space-y-3">
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {THEMES.map((t) => {
          const info = THEME_INFO[t];
          const isLive = current === t;
          const isEditing = editing === t;
          return (
            <li key={t} className={`card flex flex-col overflow-hidden transition ${isEditing ? 'ring-2 ring-brand' : ''}`}>
              <div className="relative h-44 overflow-hidden border-b border-line" aria-hidden="true">
                <ThemeThumb theme={t} photos={photos} />
                {isLive && <span className="absolute right-2 top-2 z-10 rounded-full bg-ok px-2 py-0.5 text-[11px] font-bold text-white shadow">LIVE</span>}
              </div>
              <div className="flex flex-1 flex-col gap-2 p-3.5">
                <p className="font-semibold">{info.name}</p>
                <p className="flex-1 text-[12.5px] text-muted">{info.tagline}</p>
                <div className="flex flex-wrap gap-1.5">
                  {isLive ? (
                    <span className="btn btn-sm flex-1 cursor-default bg-ok/10 text-ok"><Icon name="check" size={14} /> Live now</span>
                  ) : (
                    <button type="button" disabled={pending} onClick={() => activate(t)} className="btn btn-primary btn-sm flex-1">{pending ? '…' : 'Activate'}</button>
                  )}
                  <a href={`/preview/${t}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm" title="Open a preview in a new tab"><Icon name="eye" size={14} /> Preview</a>
                  <Link href={`/admin/homepage?theme=${t}`} aria-current={isEditing ? 'page' : undefined} className={`btn btn-sm ${isEditing ? 'bg-tint text-brand-ink' : 'btn-ghost'}`}><Icon name="pencil" size={14} /> Edit</Link>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {msg && <p role="status" className={`rounded-xl px-4 py-3 text-sm ${msg.ok ? 'bg-ok/10 text-ok' : 'bg-bad/10 text-bad'}`}>{msg.text}</p>}
    </section>
  );
}

/** A miniature of each theme's home page, drawn with the shop's own product photos. */
function ThemeThumb({ theme, photos }: { theme: ThemeKey; photos: string[] }) {
  const p = (i: number) => (photos.length ? photos[i % photos.length] : null);
  const Pic = ({ i, className = '' }: { i: number; className?: string }) => (
    <span className={`${className.includes('absolute') ? '' : 'relative'} block overflow-hidden bg-soft ${className}`}><ProductImage path={p(i)} alt="" sizes="120px" /></span>
  );
  const lines = (dark: boolean, serif = false) => (
    <span className="flex flex-col gap-1">
      <span className={`h-[7px] w-16 rounded-sm ${dark ? 'bg-white' : 'bg-night'} ${serif ? 'opacity-80' : ''}`} />
      <span className={`h-[7px] w-12 rounded-sm ${dark ? 'bg-brand' : serif ? 'bg-night opacity-80' : 'bg-night'}`} />
      <span className={`mt-0.5 h-[3px] w-14 rounded-sm ${dark ? 'bg-white/40' : 'bg-night/25'}`} />
      <span className={`h-[3px] w-10 rounded-sm ${dark ? 'bg-white/40' : 'bg-night/25'}`} />
    </span>
  );
  const bar = (dark = false) => (
    <span className={`flex items-center justify-between px-2.5 py-1.5 ${dark ? 'bg-night' : 'bg-white/80'}`}>
      <span className="h-[6px] w-8 rounded-sm bg-brand" />
      <span className="flex gap-1.5">{[0, 1, 2, 3].map((n) => <span key={n} className={`h-[3px] w-4 rounded-sm ${dark ? 'bg-white/50' : 'bg-night/30'}`} />)}</span>
      <span className={`h-2 w-2 rounded-full ${dark ? 'bg-white/60' : 'bg-night/40'}`} />
    </span>
  );

  if (theme === 'luxora') {
    return (
      <div className="flex h-full flex-col bg-cream">
        {bar()}
        <div className="grid flex-1 grid-cols-2 items-center">
          <span className="space-y-2 px-3">{lines(false, true)}<span className="block h-3 w-10 rounded-sm bg-night" /></span>
          <Pic i={0} className="h-full" />
        </div>
        <span className="flex justify-center gap-2 bg-white py-1.5">{[1, 2, 3, 4, 5].map((n) => <Pic key={n} i={n} className="h-7 w-7 rounded-full ring-1 ring-brand/20" />)}</span>
      </div>
    );
  }
  if (theme === 'shopease') {
    return (
      <div className="flex h-full flex-col bg-white">
        {bar()}
        <div className="mx-2 mt-1 grid flex-1 grid-cols-2 items-center overflow-hidden rounded-md bg-night">
          <span className="space-y-2 px-2.5">{lines(true)}<span className="block h-3 w-10 rounded-sm bg-brand" /></span>
          <span className="relative h-full"><Pic i={0} className="absolute inset-1 rounded" /><span className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-brand text-[6px] font-bold text-white">-20%</span></span>
        </div>
        <span className="grid grid-cols-4 gap-1.5 p-2">{[1, 2, 3, 4].map((n) => <Pic key={n} i={n} className="aspect-square rounded" />)}</span>
      </div>
    );
  }
  if (theme === 'luxe') {
    return (
      <div className="flex h-full flex-col bg-white">
        {bar()}
        <div className="grid flex-1 grid-cols-[1fr_1.2fr] items-center gap-1 px-2">
          <span className="space-y-2 pl-1">{lines(false, true)}<span className="block h-3 w-10 rounded bg-night" /></span>
          <Pic i={0} className="h-[88%] rounded-xl" />
        </div>
        <span className="flex justify-around px-2 py-1.5">{[1, 2, 3, 4, 5, 6].map((n) => <Pic key={n} i={n} className="h-6 w-6 rounded-full" />)}</span>
      </div>
    );
  }
  if (theme === 'topdeal') {
    return (
      <div className="flex h-full flex-col bg-white">
        {bar(true)}
        <div className="mx-1.5 mt-1 grid grid-cols-[1.4fr_1fr] gap-1">
          <span className="relative h-16 overflow-hidden rounded bg-[#fbbf24]"><Pic i={0} className="absolute inset-y-0 right-0 w-1/2" /></span>
          <span className="grid grid-cols-2 gap-0.5">{[1, 2, 3, 4, 5, 6].map((n) => <Pic key={n} i={n} className="rounded-sm" />)}</span>
        </div>
        <span className="flex justify-around px-1.5 py-1.5">{[1, 2, 3, 4, 5, 6].map((n) => <Pic key={n} i={n} className="h-6 w-6 rounded-full" />)}</span>
        <div className="grid flex-1 grid-cols-[28%_1fr] gap-1 px-1.5 pb-1.5">
          <span className="flex flex-col gap-0.5 rounded bg-soft p-1">{[0, 1, 2, 3].map((n) => <span key={n} className="h-1.5 rounded-sm bg-night/20" />)}</span>
          <span className="grid grid-cols-4 gap-0.5">{[3, 4, 5, 6].map((n) => <Pic key={n} i={n} className="rounded-sm" />)}</span>
        </div>
      </div>
    );
  }
  if (theme === 'urban') {
    return (
      <div className="flex h-full flex-col bg-white">
        {bar()}
        <span className="relative h-16 bg-night"><Pic i={0} className="absolute inset-0 opacity-60" /><span className="absolute left-2 top-4 h-2 w-16 rounded-sm bg-white" /><span className="absolute left-2 top-8 h-2 w-10 rounded-sm bg-brand" /></span>
        <span className="mx-auto mt-1.5 h-1.5 w-16 rounded-sm bg-night" />
        <span className="grid grid-cols-4 gap-1 px-3 pt-1.5">{[1, 2, 3, 4].map((n) => <Pic key={n} i={n} className="aspect-square" />)}</span>
        <span className="grid grid-cols-4 gap-1 px-3 pt-1">{[5, 6, 7, 1].map((n) => <span key={n} className="relative aspect-[4/3] bg-night"><Pic i={n} className="absolute inset-0 opacity-60" /></span>)}</span>
      </div>
    );
  }
  if (theme === 'mega') {
    return (
      <div className="flex h-full flex-col bg-white">
        {bar(true)}
        <span className="flex gap-1 bg-night px-2 pb-1.5"><span className="h-2 w-10 rounded-sm bg-brand" /><span className="h-2 flex-1 rounded-sm bg-white/80" /></span>
        <div className="grid flex-1 grid-cols-[28%_1fr] gap-1 p-1.5">
          <span className="flex flex-col gap-0.5 rounded bg-soft p-1">{[0, 1, 2, 3, 4, 5].map((n) => <span key={n} className="h-1.5 rounded-sm bg-night/20" />)}</span>
          <span className="grid grid-rows-[1fr_auto] gap-1">
            <span className="grid grid-cols-[2fr_1fr] gap-1"><Pic i={0} className="rounded" /><span className="grid gap-1"><Pic i={1} className="rounded" /><Pic i={2} className="rounded" /></span></span>
            <span className="grid grid-cols-5 gap-0.5">{[3, 4, 5, 6, 7].map((n) => <Pic key={n} i={n} className="aspect-square rounded-sm" />)}</span>
          </span>
        </div>
      </div>
    );
  }
  if (theme === 'market') {
    return (
      <div className="flex h-full flex-col bg-white">
        {bar()}
        <span className="mx-2 mt-1 h-1.5 rounded-full bg-brand" />
        <span className="mx-2 mt-1 grid grid-cols-5 gap-1">{[0, 1, 2, 3, 4].map((n) => <span key={n} className="h-2.5 rounded-sm bg-tint" />)}</span>
        <div className="mx-2 mt-1 grid flex-1 grid-cols-[1.7fr_1fr] gap-1">
          <span className="relative overflow-hidden rounded bg-[#fde3c4]"><Pic i={0} className="absolute inset-y-0 right-0 w-1/2" /></span>
          <span className="grid gap-1"><Pic i={1} className="rounded" /><Pic i={2} className="rounded" /></span>
        </div>
        <span className="grid grid-cols-5 gap-1 p-2">{[3, 4, 5, 6, 7].map((n) => <Pic key={n} i={n} className="aspect-square rounded ring-1 ring-line" />)}</span>
      </div>
    );
  }
  if (theme === 'chic') {
    return (
      <div className="flex h-full flex-col bg-cream">
        {bar()}
        <div className="relative grid flex-1 grid-cols-2 items-center">
          <span className="space-y-2 px-3">{lines(false, true)}<span className="block h-3 w-10 rounded bg-brand" /></span>
          <span className="relative h-full">
            <span className="absolute right-1 top-2 aspect-square w-[80%] rounded-full bg-brand/80" />
            <Pic i={0} className="absolute bottom-0 left-[18%] right-[10%] top-[8%] rounded-t-full" />
          </span>
        </div>
        <span className="-mt-2 mx-2 mb-1 grid grid-cols-4 gap-1 rounded bg-white p-1 shadow-sm">{[0, 1, 2, 3].map((n) => <span key={n} className="h-1.5 rounded-sm bg-brand/30" />)}</span>
        <span className="grid grid-cols-4 gap-1 px-2 pb-2">{[1, 2, 3, 4].map((n) => <Pic key={n} i={n} className="aspect-[4/5] rounded" />)}</span>
      </div>
    );
  }
  // NovaTrend
  return (
    <div className="flex h-full flex-col bg-white">
      {bar()}
      <div className="relative grid flex-1 grid-cols-2 items-center">
        <span className="space-y-2 px-3">{lines(false)}<span className="block h-3 w-10 rounded bg-brand" /></span>
        <span className="relative h-full">
          <span className="absolute -right-6 top-2 h-28 w-28 rounded-full bg-brand/15 blur-xl" />
          <Pic i={0} className="absolute inset-x-5 inset-y-3 rounded-2xl" />
          <span className="absolute left-0 top-3 w-9 rounded bg-white p-0.5 shadow"><Pic i={1} className="aspect-square rounded-sm" /></span>
          <span className="absolute bottom-3 right-1 w-9 rounded bg-white p-0.5 shadow"><Pic i={2} className="aspect-square rounded-sm" /></span>
        </span>
      </div>
      <span className="grid grid-cols-5 gap-1 px-2 pb-2">{[3, 4, 5, 6, 7].map((n) => <Pic key={n} i={n} className="aspect-[4/5] rounded" />)}</span>
    </div>
  );
}
