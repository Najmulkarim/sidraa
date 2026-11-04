'use client';

import { useEffect, useState, type DragEvent, type HTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { PHOTO_ACCEPT } from '@/lib/upload-photo';
import { Icon } from '../icons';
import { ProductImage } from '../shop/ProductImage';

export type GridPhoto = { key: string; path: string; alt: string };

const MAX = 20;
// Small tiles beside and below the cover: 12 fill two rows on a wide screen (8 across) and on a phone (4 across).
const SMALL_TILES = 12;

/**
 * Product photos as a shop-style grid: the cover large (2 × 2), the rest at
 * half size beside and below it, then numbered empty boxes that add photos
 * (click, or drop files on them). Drag a photo to change the order.
 */
export function PhotoGrid({ photos, productName, busy, dragging, handlers, onAdd, onRemove, onMove }: {
  photos: GridPhoto[];
  productName: string;
  busy: boolean;
  dragging: number | null;
  handlers: (i: number) => HTMLAttributes<HTMLElement>;
  onAdd: (files: File[]) => void;
  onRemove: (i: number) => void;
  onMove: (i: number, d: -1 | 1) => void;
}) {
  const [asking, setAsking] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  // Empty boxes complete the rows, and there is always one while photos can be added.
  const smallUsed = Math.max(0, photos.length - 1);
  const empty = photos.length >= MAX ? 0 : (photos.length === 0 ? 1 : 0) + Math.max(1, SMALL_TILES - smallUsed);

  useEffect(() => {
    if (asking === null) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAsking(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [asking]);

  const drop = (e: DragEvent, slot: number) => {
    e.preventDefault();
    setOver(null);
    const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'));
    if (files.length) onAdd(files);
    void slot;
  };

  return (
    <>
      <ul className="grid grid-cols-4 gap-2.5 sm:grid-cols-6 lg:grid-cols-8">
        {photos.map((ph, i) => (
          <li
            key={ph.key}
            {...handlers(i)}
            className={`group relative min-w-0 select-none overflow-hidden rounded-2xl border border-line bg-tint transition ${i === 0 ? 'col-span-2 row-span-2' : 'aspect-square'} ${dragging === i ? 'z-10 scale-[1.03] opacity-80 shadow-xl ring-2 ring-brand' : 'hover:shadow-md'}`}
          >
            <div className="pointer-events-none absolute inset-0">
              <ProductImage path={ph.path} alt={ph.alt || productName} sizes={i === 0 ? '320px' : '160px'} />
            </div>
            {i === 0 && <span className="absolute left-2 top-2 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-brand shadow-sm">Cover</span>}
            <button
              type="button"
              onClick={() => setAsking(i)}
              aria-label={`Remove photo ${i + 1}`}
              title="Remove"
              className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-white/95 text-brand shadow-sm transition hover:bg-brand hover:text-white"
            >
              <Icon name="x" size={15} />
            </button>
            {/* Move buttons for keyboards and small screens; dragging works too. */}
            <div className="absolute inset-x-2 bottom-2 flex justify-between opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
              <button type="button" disabled={i === 0} onClick={() => onMove(i, -1)} aria-label="Move earlier" className="grid h-7 w-7 place-items-center rounded-full bg-white/95 text-ink shadow-sm disabled:invisible">←</button>
              <button type="button" disabled={i === photos.length - 1} onClick={() => onMove(i, 1)} aria-label="Move later" className="grid h-7 w-7 place-items-center rounded-full bg-white/95 text-ink shadow-sm disabled:invisible">→</button>
            </div>
          </li>
        ))}
        {Array.from({ length: empty }, (_, k) => {
          const n = photos.length + k + 1;
          const first = photos.length === 0 && k === 0;
          return (
            <li key={`empty-${n}`} className={first ? 'col-span-2 row-span-2' : 'aspect-square'}>
              <label
                onDragOver={(e) => { e.preventDefault(); setOver(n); }}
                onDragLeave={() => setOver(null)}
                onDrop={(e) => drop(e, n)}
                className={`relative flex h-full cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed text-center transition ${over === n ? 'border-brand bg-tint' : 'border-line bg-soft/50 hover:border-brand/60 hover:bg-tint/50'} ${busy ? 'pointer-events-none opacity-60' : ''}`}
              >
                <span className="absolute right-1.5 top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-white sm:right-2 sm:top-2 sm:h-6 sm:min-w-6 sm:text-[11px]">{n}</span>
                <span className="text-xl leading-none text-muted" aria-hidden>＋</span>
                <span className={`text-[12px] font-semibold text-ink/70 ${first ? '' : 'hidden sm:inline'}`}>{busy ? 'Uploading…' : first ? 'Add the cover photo' : 'Add photo'}</span>
                {first && <span className="text-[11px] text-muted">Click, or drop photos here</span>}
                <input type="file" accept={PHOTO_ACCEPT} multiple className="sr-only" disabled={busy} aria-label={`Add photo ${n}`} onChange={(e) => { const f = [...(e.target.files ?? [])]; e.target.value = ''; if (f.length) onAdd(f); }} />
              </label>
            </li>
          );
        })}
      </ul>

      {asking !== null && photos[asking] && createPortal(
        <div className="fixed inset-0 z-50 grid place-items-center bg-night/50 p-4 backdrop-blur-sm" role="alertdialog" aria-modal="true" aria-labelledby="rm-photo-title" onClick={() => setAsking(null)}>
          <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 text-left shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="relative h-28 w-24 overflow-hidden rounded-xl border border-line bg-tint">
              <ProductImage path={photos[asking].path} alt="" sizes="96px" />
            </div>
            <div>
              <h2 id="rm-photo-title" className="text-lg font-bold">Remove this photo?</h2>
              <p className="mt-1 text-sm text-muted">{asking === 0 ? 'It is the cover: the next photo becomes the cover.' : 'It is removed from the product.'}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setAsking(null)} autoFocus className="btn btn-outline flex-1">Cancel</button>
              <button type="button" onClick={() => { const i = asking; setAsking(null); onRemove(i); }} className="btn flex-1 bg-bad text-white hover:opacity-90">Yes, remove</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
