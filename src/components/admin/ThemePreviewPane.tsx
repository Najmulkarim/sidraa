'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '../icons';

const WIDTH = { mobile: 390, desktop: 1280 } as const;

/** The section open in the editor, with its unsaved edits. */
export type PreviewDraft = { id: string; name: string; title: string; subtitle: string; settings: unknown; /** Changed since the last save. */ dirty: boolean };

/** JSON → base64url (Bangla text safe), for the preview address. */
function encodeDraft(d: PreviewDraft): string {
  const bytes = new TextEncoder().encode(JSON.stringify({ id: d.id, title: d.title, subtitle: d.subtitle, settings: d.settings }));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const MARK_STYLE = 'sidraa-editing-style';

/**
 * Live preview beside the Homepage editor: the theme's page in a frame, scaled
 * to fit. It reloads after every save, and — while a section is open — shows
 * that section's unsaved edits a moment after each change, scrolled to and
 * outlined with an "Editing" label so it is clear which part is being changed.
 */
export function ThemePreviewPane({ theme, version, focus, draft, onClose }: { theme: string; version: number; focus: string | null; draft?: PreviewDraft | null; onClose?: () => void }) {
  const [mode, setMode] = useState<keyof typeof WIDTH>('mobile');
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [loading, setLoading] = useState(true);
  const [manual, setManual] = useState(0);
  const [d, setD] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Unsaved edits reach the preview after a short pause in typing.
  const encoded = draft?.dirty ? encodeDraft(draft) : '';
  useEffect(() => {
    if (encoded === d) return;
    const t = setTimeout(() => setD(encoded.length <= 30_000 ? encoded : ''), encoded && d ? 700 : 0);
    return () => clearTimeout(t);
  }, [encoded, d]);

  /** Outline the open section and scroll to it. */
  function mark(smooth: boolean) {
    const doc = frame.current?.contentDocument;
    if (!doc) return;
    doc.getElementById(MARK_STYLE)?.remove();
    doc.querySelectorAll('[data-editing]').forEach((el) => el.removeAttribute('data-editing'));
    if (!focus) return;
    const el = doc.getElementById(`sec-${focus}`);
    if (!el) return;
    el.setAttribute('data-editing', draft?.name ? `Editing: ${draft.name}` : 'Editing');
    const style = doc.createElement('style');
    style.id = MARK_STYLE;
    style.textContent = `
      [data-editing]{position:relative;outline:3px solid #e6007e;outline-offset:-3px;border-radius:6px;scroll-margin-top:96px}
      [data-editing]::before{content:attr(data-editing);position:absolute;z-index:60;top:6px;left:6px;background:#e6007e;color:#fff;font:700 12px/1 system-ui,sans-serif;padding:6px 10px;border-radius:999px;box-shadow:0 2px 8px rgba(0,0,0,.25);pointer-events:none}`;
    doc.head.appendChild(style);
    el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
  }

  useEffect(() => { mark(true); }, [focus]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setLoading(true); }, [version, manual, mode, d]);

  const scale = size.w ? Math.min(1, size.w / WIDTH[mode]) : 1;
  const src = `/preview/${theme}?embed=1&v=${version}${d ? `&d=${d}` : ''}`;
  const unsaved = !!d;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <span className="flex items-center gap-1.5 text-[13px] font-semibold"><span className={`h-2 w-2 rounded-full ${loading ? 'animate-pulse bg-[#f59e0b]' : 'bg-ok'}`} /> Live preview</span>
        <div className="ml-auto flex rounded-lg bg-soft p-0.5" role="group" aria-label="Screen size">
          {(['mobile', 'desktop'] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m} className={`rounded-md px-2.5 py-1 text-[12px] font-semibold capitalize transition ${mode === m ? 'bg-white text-night shadow-sm' : 'text-muted hover:text-night'}`}>{m}</button>
          ))}
        </div>
        <button type="button" onClick={() => setManual((n) => n + 1)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-soft hover:text-night" title="Reload preview" aria-label="Reload preview"><Icon name="refresh" size={16} /></button>
        <a href={`/preview/${theme}`} target="_blank" rel="noopener noreferrer" className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-soft hover:text-night" title="Open full preview in a new tab" aria-label="Open full preview"><Icon name="external" size={16} /></a>
        {onClose && <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-soft hover:text-night" aria-label="Close preview"><Icon name="x" size={17} /></button>}
      </div>
      {focus && draft && (
        <p className="flex items-center gap-2 border-b border-line bg-tint/60 px-3 py-1.5 text-[12px]">
          <Icon name="pencil" size={13} className="shrink-0 text-brand" />
          <span className="min-w-0 truncate">Editing <b>{draft.name}</b>{unsaved ? ' — showing your changes (not saved yet)' : ''}</span>
        </p>
      )}
      <div ref={box} className="relative min-h-0 flex-1 overflow-hidden bg-[#eceaf1]">
        {size.w > 0 && (
          <iframe
            key={`${manual}-${mode}`}
            ref={frame}
            src={src}
            title="Home page preview"
            onLoad={() => { setLoading(false); mark(false); }}
            className="absolute left-1/2 top-0 origin-top border-0 bg-white"
            style={{ width: WIDTH[mode], height: size.h / scale, transform: `translateX(-50%) scale(${scale})` }}
          />
        )}
      </div>
      <p className="border-t border-line px-3 py-1.5 text-[11.5px] text-muted">{unsaved ? 'Preview only — press Save section to put it on the website.' : 'Visitors see changes only after you save, on the live theme.'}</p>
    </div>
  );
}
