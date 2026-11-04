'use client';

import { useState } from 'react';
import { removeUploadedPhoto, uploadProductPhoto } from '@/lib/upload-photo';
import { PhotoGrid } from './PhotoGrid';
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
        <p className="text-xs text-muted">The first photo is the cover. Drag photos to change the order. JPG, PNG, WebP or AVIF up to 5 MB each, up to 20 photos. Add a photo for each colour, then pick it in Variations below.</p>
      </div>
      {message && <p className="text-sm text-bad" role="alert">{message}</p>}
      <PhotoGrid
        photos={list.map((ph) => ({ key: ph.path, path: ph.path, alt: ph.alt }))}
        productName={productName}
        busy={busy}
        dragging={dragging}
        handlers={handlers}
        onAdd={(files) => void add(files)}
        onRemove={remove}
        onMove={move}
      />
    </section>
  );
}
