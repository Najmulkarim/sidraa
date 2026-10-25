'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '../icons';

const WIDTH = { mobile: 390, desktop: 1280 } as const;

/**
 * Live preview beside the Homepage editor: the theme's page in a frame,
 * scaled to fit. It reloads when `version` changes (after every save) and
 * scrolls to the section that is open in the editor.
 */
export function ThemePreviewPane({ theme, version, focus, onClose }: { theme: string; version: number; focus: string | null; onClose?: () => void }) {
  const [mode, setMode] = useState<keyof typeof WIDTH>('mobile');
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [loading, setLoading] = useState(true);
  const [manual, setManual] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function scrollToFocus(smooth: boolean) {
    const doc = frame.current?.contentDocument;
    if (!doc || !focus) return;
    doc.getElementById(`sec-${focus}`)?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
  }

  // A new open section: glide to it.
  useEffect(() => { scrollToFocus(true); }, [focus]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setLoading(true); }, [version, manual, mode]);

  const scale = size.w ? Math.min(1, size.w / WIDTH[mode]) : 1;

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
      <div ref={box} className="relative min-h-0 flex-1 overflow-hidden bg-[#eceaf1]">
        {size.w > 0 && (
          <iframe
            key={`${version}-${manual}-${mode}`}
            ref={frame}
            src={`/preview/${theme}?embed=1`}
            title="Home page preview"
            onLoad={() => { setLoading(false); scrollToFocus(false); }}
            className="absolute left-1/2 top-0 origin-top border-0 bg-white"
            style={{ width: WIDTH[mode], height: size.h / scale, transform: `translateX(-50%) scale(${scale})` }}
          />
        )}
      </div>
      <p className="border-t border-line px-3 py-1.5 text-[11.5px] text-muted">Updates after every save. Visitors see changes only on the live theme.</p>
    </div>
  );
}
