'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type ChangeEvent } from 'react';
import { addProductImage, deleteImage, moveImage, reorderImages, updateImageAlt } from '@/actions/admin-catalog';
import { PHOTO_ACCEPT, uploadProductPhoto } from '@/lib/upload-photo';
import type { ProductImage as Img } from '@/lib/types';
import { Icon } from '../icons';
import { ProductImage } from '../shop/ProductImage';
import { useDragSort } from './useDragSort';
import { notify } from './Toaster';


/**
 * Uploads go straight from the browser to Supabase Storage with the
 * admin's own session; the bucket policy checks is_admin() and the bucket
 * itself rejects non-images and files over 5 MB. The server action then
 * records the image row.
 */
export function ImageManager({ productId, images, productName }: { productId: string; images: Img[]; productName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  // Shown immediately after a drop, until the server confirms.
  const [optimistic, setOptimistic] = useState<Img[] | null>(null);
  const shown = optimistic && optimistic.length === images.length ? optimistic : images;
  const { list, dragging, handlers } = useDragSort(shown, (next) => {
    setOptimistic(next);
    startTransition(async () => {
      const res = await reorderImages(productId, next.map((x) => x.id));
      setMessage(res.ok ? 'Photo order saved.' : res.message ?? 'Could not save the order.');
      notify(res.ok, res.ok ? 'Photo order saved.' : res.message);
      router.refresh();
      setOptimistic(null);
    });
  });

  async function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])];
    e.target.value = '';
    if (files.length === 0) return;
    setBusy(true);
    setMessage(null);
    const problems: string[] = [];
    for (const file of files) {
      const up = await uploadProductPhoto(productId, file);
      if ('error' in up) { problems.push(up.error); continue; }
      const res = await addProductImage({ productId, storagePath: up.path, alt: productName });
      if (!res.ok) problems.push(`${file.name}: ${res.message}`);
    }
    setBusy(false);
    setMessage(problems.length ? problems.join(' ') : 'Uploaded.');
    notify(!problems.length, problems.length ? problems.join(' ') : 'Photos uploaded.');
    router.refresh();
  }

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok && res.message) setMessage(res.message);
      router.refresh();
    });

  return (
    <section className="card space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">Photos</h2>
          <p className="text-xs text-muted">Drag photos to change the order — the first one is the cover. JPG, PNG, WebP or AVIF up to 5 MB. Portrait 3:4 looks best.</p>
        </div>
        <label className={`btn btn-outline btn-sm ${busy ? 'pointer-events-none opacity-60' : ''}`}>
          {busy ? 'Uploading…' : 'Add photos'}
          <input type="file" accept={PHOTO_ACCEPT} multiple className="sr-only" onChange={onFiles} disabled={busy} />
        </label>
      </div>
      {message && <p className="text-sm text-muted" role="status">{message}</p>}
      {images.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">No photos yet. The shop shows a neutral placeholder until you add one.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
          {list.map((img, i) => (
            <li key={img.id} className={`min-w-0 space-y-1 select-none rounded-xl transition ${dragging === i ? 'scale-[1.03] opacity-80 shadow-xl ring-2 ring-brand' : ''}`} {...handlers(i)}>
              <div className="pointer-events-none relative aspect-[3/4] overflow-hidden rounded-xl border border-line">
                <ProductImage path={img.storage_path} alt={img.alt ?? productName} sizes="160px" />
                {i === 0 && <span className="badge badge-brand absolute left-1 top-1 bg-white text-[10px]">Cover</span>}
              </div>
              <input
                aria-label="Alt text"
                defaultValue={img.alt ?? ''}
                maxLength={200}
                placeholder="Describe the photo"
                className="input min-h-8 px-2 py-1 text-xs"
                onBlur={(e) => {
                  if (e.target.value !== (img.alt ?? '')) run(() => updateImageAlt(img.id, e.target.value));
                }}
              />
              <div className="flex justify-between">
                <button type="button" className="btn btn-ghost btn-sm min-h-8 px-1.5" disabled={i === 0} onClick={() => run(() => moveImage(img.id, 'up'))} aria-label="Move earlier">←</button>
                <button type="button" className="btn btn-ghost btn-sm min-h-8 px-1.5" disabled={i === list.length - 1} onClick={() => run(() => moveImage(img.id, 'down'))} aria-label="Move later">→</button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm min-h-8 px-1.5 text-bad"
                  aria-label={`Remove photo ${i + 1}`}
                  title="Remove"
                  onClick={() => {
                    if (window.confirm('Remove this photo?')) run(() => deleteImage(img.id));
                  }}
                >
                  <Icon name="trash" size={15} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
