'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { activateTheme } from '@/actions/admin-home';
import { THEME_INFO, THEMES, type ThemeKey } from '@/lib/home-sections';
import { Icon } from '../icons';

/** Theme cards: preview any theme, edit its sections, make it live in one click. */
export function ThemePicker({ live, editing }: { live: ThemeKey; editing: ThemeKey }) {
  const [current, setCurrent] = useState(live);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function activate(t: ThemeKey) {
    setMsg(null);
    start(async () => {
      const r = await activateTheme(t);
      if (r.ok) setCurrent(t);
      setMsg({ ok: r.ok, text: r.message ?? '' });
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
              {/* A tiny drawing of the layout in the theme's colours. */}
              <div className="relative h-28 overflow-hidden border-b border-line" style={{ background: info.swatches[0] }} aria-hidden="true">
                <span className="absolute inset-x-3 top-3 h-2 rounded-full opacity-60" style={{ background: info.swatches[1] }} />
                <span className="absolute left-3 top-8 h-12 w-[45%] rounded-md opacity-80" style={{ background: info.swatches[1] }} />
                <span className="absolute right-3 top-8 h-12 w-[40%] rounded-md" style={{ background: info.swatches[2] }} />
                <span className="absolute inset-x-3 bottom-3 flex gap-1.5">
                  {[0, 1, 2, 3].map((n) => <span key={n} className="h-5 flex-1 rounded-sm bg-black/10" />)}
                </span>
                {isLive && <span className="absolute right-2 top-2 rounded-full bg-ok px-2 py-0.5 text-[11px] font-bold text-white shadow">LIVE</span>}
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
