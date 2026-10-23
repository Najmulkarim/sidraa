'use client';

import { useState, type ChangeEvent, type DragEvent } from 'react';
import { PHOTO_ACCEPT, removeUploadedPhoto, uploadProductPhoto } from '@/lib/upload-photo';
import { ProductImage } from '../shop/ProductImage';
import { useDragSort } from './useDragSort';

export type PendingPhoto = { path: string; alt: string };

/**
 * Photos on the New product page, before the first save. Files go to
 * Storage under the product's future id; the photo rows are written when
 * the product is created (saveProduct), in this order.
 */
export function NewProductPhotos({ productId, photos, onChange, productName }: { productId: string; photos: PendingPhoto[]; onChange: (p: PendingPhoto[]) => void; productName: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const { list, dragging, handlers } = useDragSort(photos, onChange);

  async function add(files: File[]) {
    if (files.length === 0) return;
    setBusy(true);
    setMessage(null);
    const added: PendingPhoto[] = [];
    const problems: string[] = [];
    for (const file of files.slice(0, Math.max(0, 20 - photos.length))) {
      const up = await uploadProductPhoto(productId, file);
      if ('error' in up) problems.push(up.error);
      else added.push({ path: up.path, alt: '' });
    }
    if (files.length > 20 - photos.length) problems.push('At most 20 photos.');
    onChange([...photos, ...added]);
    setBusy(false);
    setMessage(problems.length ? problems.join(' ') : null);
  }

  const onFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])];
    e.target.value = '';
    void add(files);
  };
  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setOver(false);
    void add([...e.dataTransfer.files]);
  };
  const move = (i: number, d: -1 | 1) => {
    const next = [...photos];
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x!);
    onChange(next);
  };
  const remove = (i: number) => {
    void removeUploadedPhoto(photos[i]!.path);
    onChange(photos.filter((_, j) => j !== i));
  };

  return (
    <section className="card space-y-4 p-5">
      <div>
        <h2 className="font-semibold">Photos</h2>
        <p className="text-xs text-muted">The first photo is the cover. JPG, PNG, WebP or AVIF up to 5 MB. Portrait 3:4 looks best. Drag photos to change the order. Add a photo for each colour, then pick it in Variations below.</p>
      </div>
      <label
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${over ? 'border-brand bg-tint' : 'border-line hover:border-brand/60'} ${busy ? 'pointer-events-none opacity-60' : ''}`}
      >
        <span className="text-2xl" aria-hidden="true">＋</span>
        <span className="text-sm font-semibold">{busy ? 'Uploading…' : 'Click to choose photos, or drop them here'}</span>
        <span className="text-xs text-muted">You can pick several at once</span>
        <input type="file" accept={PHOTO_ACCEPT} multiple className="sr-only" onChange={onFiles} disabled={busy} aria-label="Add photos" />
      </label>
      {message && <p className="text-sm text-bad" role="alert">{message}</p>}
      {photos.length > 0 && (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {list.map((ph, i) => (
            <li key={ph.path} className={`space-y-1.5 select-none rounded-xl transition ${dragging === i ? 'scale-[1.03] opacity-80 shadow-xl ring-2 ring-brand' : ''}`} {...handlers(i)}>
              <div className="pointer-events-none relative aspect-[3/4] overflow-hidden rounded-xl border border-line bg-tint">
                <ProductImage path={ph.path} alt={ph.alt || productName} sizes="160px" />
                {i === 0 && <span className="badge badge-brand absolute left-1 top-1 bg-white">Cover</span>}
              </div>
              <input
                aria-label={`Describe photo ${i + 1}`}
                value={ph.alt}
                maxLength={200}
                placeholder="Describe the photo"
                className="input min-h-8 py-1 text-xs"
                onChange={(e) => onChange(photos.map((x, j) => (j === i ? { ...x, alt: e.target.value } : x)))}
              />
              <div className="flex justify-between">
                <button type="button" className="btn btn-ghost btn-sm px-2" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move earlier">←</button>
                <button type="button" className="btn btn-ghost btn-sm px-2" disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label="Move later">→</button>
                <button type="button" className="btn btn-ghost btn-sm px-2 text-bad" onClick={() => remove(i)} aria-label={`Remove photo ${i + 1}`}>Remove</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
