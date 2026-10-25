'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { activateTheme, setThemeHidden } from '@/actions/admin-home';
import { THEME_GROUPS, THEME_INFO, THEMES, type ThemeGroup, type ThemeKey } from '@/lib/home-sections';
import { Icon } from '../icons';
import { ProductImage } from '../shop/ProductImage';
import { notify } from './Toaster';

/** Theme gallery: the live theme on top, group filters, then one card per theme (preview, edit, go live, delete); deleted ones can be restored. */
export function ThemePicker({ live, editing, hidden, photos }: { live: ThemeKey; editing: ThemeKey; hidden: ThemeKey[]; photos: string[] }) {
  const [current, setCurrent] = useState(live);
  const [gone, setGone] = useState<ThemeKey[]>(hidden);
  // Delete asks first.
  const [ask, setAsk] = useState<ThemeKey | null>(null);
  const [group, setGroup] = useState<ThemeGroup | 'all'>('all');
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<ThemeKey | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function activate(t: ThemeKey) {
    setMsg(null);
    setBusy(t);
    start(async () => {
      const r = await activateTheme(t);
      if (r.ok) setCurrent(t);
      setMsg({ ok: r.ok, text: r.message ?? '' });
      notify(r.ok, r.message);
      setBusy(null);
    });
  }

  function hide(t: ThemeKey, value: boolean) {
    setMsg(null);
    setBusy(t);
    start(async () => {
      const r = await setThemeHidden(t, value);
      if (r.ok) setGone((cur) => (value ? [...cur.filter((x) => x !== t), t] : cur.filter((x) => x !== t)));
      setMsg({ ok: r.ok, text: r.message ?? '' });
      notify(r.ok, r.message);
      setBusy(null);
      setAsk(null);
    });
  }

  const liveInfo = THEME_INFO[current];
  const kept = THEMES.filter((t) => !gone.includes(t));
  const shown = kept.filter((t) => group === 'all' || THEME_INFO[t].group === group);
  const chips: { key: ThemeGroup | 'all'; name: string; count: number }[] = [
    { key: 'all', name: 'All themes', count: kept.length },
    ...THEME_GROUPS.map((g) => ({ key: g.key, name: g.name, count: kept.filter((t) => THEME_INFO[t].group === g.key).length })),
  ];

  return (
    <section className="space-y-5">
      {/* The live theme, large. */}
      <div className="card grid overflow-hidden md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="self-center border-b border-line md:border-b-0 md:border-r" aria-hidden="true"><Fit><ThemeThumb theme={current} photos={photos} /></Fit></div>
        <div className="flex flex-col justify-center gap-3 p-5 sm:p-6">
          <span className="flex w-fit items-center gap-1.5 rounded-full bg-ok/10 px-2.5 py-1 text-[11.5px] font-bold uppercase tracking-wide text-ok"><span className="h-2 w-2 animate-pulse rounded-full bg-ok" /> Live on your shop</span>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{liveInfo.name}</h2>
            <p className="mt-1 text-[13.5px] text-muted">{liveInfo.tagline}</p>
          </div>
          <dl className="grid gap-1.5 text-[13px]">
            <div className="flex gap-2"><dt className="w-20 shrink-0 text-muted">Best for</dt><dd className="font-medium">{liveInfo.bestFor}</dd></div>
            <div className="flex gap-2"><dt className="w-20 shrink-0 text-muted">Group</dt><dd className="font-medium">{THEME_GROUPS.find((g) => g.key === liveInfo.group)?.name}</dd></div>
            <div className="flex items-center gap-2"><dt className="w-20 shrink-0 text-muted">Colours</dt><dd><Swatches colors={liveInfo.swatches} /></dd></div>
          </dl>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link href={`/admin/homepage?theme=${current}#sections`} className="btn btn-primary btn-sm"><Icon name="pencil" size={14} /> Edit sections</Link>
            <a href="/" target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm"><Icon name="external" size={14} /> View shop</a>
          </div>
        </div>
      </div>

      {/* Group filters. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Theme groups" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {chips.map((c) => (
            <button key={c.key} type="button" role="tab" aria-selected={group === c.key} onClick={() => setGroup(c.key)} className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${group === c.key ? 'bg-night text-white' : 'bg-soft text-ink/70 hover:bg-tint hover:text-brand-ink'}`}>
              {c.name} <span className={group === c.key ? 'text-white/60' : 'text-muted'}>{c.count}</span>
            </button>
          ))}
        </div>
        {group !== 'all' && <p className="text-[12.5px] text-muted">{THEME_GROUPS.find((g) => g.key === group)?.hint}</p>}
      </div>

      {/* Five to a line on wide screens: the ten themes fill two rows. */}
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {shown.map((t) => {
          const info = THEME_INFO[t];
          const isLive = current === t;
          const isEditing = editing === t;
          return (
            <li key={t} className={`card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg ${isLive ? 'ring-2 ring-ok' : isEditing ? 'ring-2 ring-brand' : ''}`}>
              <div className="relative overflow-hidden border-b border-line">
                <div className="transition duration-500 group-hover:scale-[1.03]" aria-hidden="true"><Fit><ThemeThumb theme={t} photos={photos} /></Fit></div>
                <a href={`/preview/${t}`} target="_blank" rel="noopener noreferrer" className="absolute inset-0 grid place-items-center bg-night/0 opacity-0 transition group-hover:bg-night/45 group-hover:opacity-100 focus-visible:bg-night/45 focus-visible:opacity-100" aria-label={`Preview ${info.name} in a new tab`}>
                  <span className="btn btn-sm bg-white px-3 text-night"><Icon name="eye" size={14} /> Preview</span>
                </a>
                {!isLive && (
                  <button type="button" disabled={pending} onClick={() => setAsk(t)} className="absolute left-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-white/95 text-bad shadow ring-1 ring-line transition hover:bg-bad hover:text-white" title="Delete this theme" aria-label={`Delete ${info.name}`}>
                    <Icon name="trash" size={14} />
                  </button>
                )}
                {isLive && <span className="absolute right-1.5 top-1.5 rounded-full bg-ok px-2 py-0.5 text-[10px] font-bold text-white shadow">LIVE</span>}
                {!isLive && isEditing && <span className="absolute right-1.5 top-1.5 rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-white shadow">EDITING</span>}
              </div>
              <div className="flex flex-1 flex-col gap-1.5 p-3">
                <div className="flex items-center justify-between gap-2">
                  <b className="min-w-0 truncate text-[14px] font-semibold">{info.name}</b>
                  <Swatches colors={info.swatches} />
                </div>
                <p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted">{THEME_GROUPS.find((g) => g.key === info.group)?.name}</p>
                <p className="line-clamp-2 text-[12px] leading-snug text-muted" title={info.tagline}>{info.tagline}</p>
                <p className="line-clamp-2 flex-1 text-[12px] leading-snug"><span className="text-muted">Best for:</span> <b className="font-medium">{info.bestFor}</b></p>
                <div className="flex gap-1 pt-1">
                  {isLive ? (
                    <span className="btn btn-sm min-w-0 flex-1 cursor-default bg-ok/10 px-2 text-ok"><Icon name="check" size={14} /> Live</span>
                  ) : (
                    <button type="button" disabled={pending} onClick={() => activate(t)} className="btn btn-primary btn-sm min-w-0 flex-1 px-1.5 text-[11px] tracking-[0.04em] sm:text-[12px]">{busy === t ? '…' : 'Activate'}</button>
                  )}
                  <a href={`/preview/${t}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm px-2.5" title="Open a preview in a new tab" aria-label={`Preview ${info.name}`}><Icon name="eye" size={15} /></a>
                  <Link href={`/admin/homepage?theme=${t}#sections`} aria-current={isEditing ? 'page' : undefined} title="Edit this theme's sections" aria-label={`Edit ${info.name}`} className={`btn btn-sm px-2.5 ${isEditing ? 'bg-tint text-brand-ink' : 'btn-ghost'}`}><Icon name="pencil" size={15} /></Link>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {shown.length === 0 && <p className="rounded-xl bg-soft px-4 py-6 text-center text-[13.5px] text-muted">No themes left in this group. Restore one below.</p>}

      {gone.length > 0 && (
        <div className="rounded-xl border border-dashed border-line p-4">
          <p className="text-[13.5px] font-semibold">Deleted themes <span className="font-normal text-muted">({gone.length}) — kept with all their sections, restore any time</span></p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {gone.map((t) => (
              <li key={t} className="flex items-center gap-2 rounded-full bg-soft py-1 pl-3.5 pr-1 text-[13px]">
                <span className="font-medium text-ink/70">{THEME_INFO[t].name}</span>
                <button type="button" disabled={pending} onClick={() => hide(t, false)} className="btn btn-sm rounded-full bg-white px-3 text-[11.5px] text-ok ring-1 ring-line hover:bg-ok hover:text-white">
                  <Icon name="restore" size={13} /> {busy === t ? '…' : 'Restore'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {ask && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-night/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="del-theme" onClick={() => !pending && setAsk(null)}>
          <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <span className="grid h-12 w-12 place-items-center rounded-full bg-bad/10 text-bad"><Icon name="trash" size={22} /></span>
            <div>
              <h2 id="del-theme" className="text-lg font-bold">Delete “{THEME_INFO[ask].name}”?</h2>
              <p className="mt-1 text-sm text-muted">It leaves your theme list. Its sections, texts and photos are kept, so you can restore it later from “Deleted themes”. Your live home page does not change.</p>
            </div>
            <div className="flex gap-2">
              <button type="button" disabled={pending} onClick={() => setAsk(null)} className="btn btn-outline flex-1">Cancel</button>
              <button type="button" disabled={pending} onClick={() => hide(ask, true)} autoFocus className="btn flex-1 bg-bad text-white hover:opacity-90">{pending ? 'Deleting…' : 'Delete theme'}</button>
            </div>
          </div>
        </div>
      )}

      {msg && <p role="status" className={`rounded-xl px-4 py-3 text-sm ${msg.ok ? 'bg-ok/10 text-ok' : 'bg-bad/10 text-bad'}`}>{msg.text}</p>}
    </section>
  );
}

/** Draws a theme miniature on a fixed 280 × 176 canvas and scales it to the box width, so every card looks the same. */
function Fit({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / 280));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={box} className="relative aspect-[280/176] w-full overflow-hidden">
      <div className="absolute left-0 top-0 h-[176px] w-[280px] origin-top-left" style={{ transform: `scale(${scale})` }}>{children}</div>
    </div>
  );
}

function Swatches({ colors }: { colors: string[] }) {
  return (
    <span className="flex -space-x-1.5" aria-hidden="true">
      {colors.map((c, i) => <span key={i} className="h-4 w-4 rounded-full ring-2 ring-white shadow-[0_0_0_1px_var(--line)]" style={{ background: c }} />)}
    </span>
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
  if (theme === 'nova') {
    return (
      <div className="flex h-full flex-col bg-white">
        <span className="h-1.5 bg-[#e2602a]" />
        <span className="flex items-center justify-between bg-[#141b2b] px-2.5 py-1.5"><span className="h-[6px] w-8 rounded-sm bg-white" /><span className="flex gap-1.5">{[0, 1, 2, 3].map((n) => <span key={n} className="h-[3px] w-4 rounded-sm bg-white/50" />)}</span><span className="h-2 w-2 rounded-full bg-white/60" /></span>
        <span className="relative h-16 bg-[#141b2b]"><Pic i={0} className="absolute inset-y-0 right-0 w-[60%] opacity-90" /><span className="absolute inset-y-0 left-0 w-[55%] bg-gradient-to-r from-[#141b2b] to-transparent" /><span className="absolute left-2 top-4 h-2 w-14 rounded-sm bg-white" /><span className="absolute left-2 top-7 h-2 w-9 rounded-sm bg-[#e2602a]" /></span>
        <span className="flex items-center gap-1.5 px-2 py-1.5"><span className="h-2 w-10 rounded-sm bg-[#141b2b]" />{[1, 2, 3, 4, 5].map((n) => <Pic key={n} i={n} className="h-5 w-5 rounded-full" />)}</span>
        <span className="grid grid-cols-2 gap-1 px-2"><span className="grid h-7 grid-cols-2 bg-[#141b2b]"><Pic i={2} /></span><span className="relative h-7 bg-[#e2602a]"><Pic i={3} className="absolute inset-0 opacity-70" /></span></span>
        <span className="grid grid-cols-6 gap-0.5 px-2 py-1.5">{[4, 5, 6, 7, 1, 2].map((n) => <Pic key={n} i={n} className="aspect-[4/5]" />)}</span>
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
