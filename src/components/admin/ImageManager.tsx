'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { addProductImage, deleteImage, moveImage, reorderImages } from '@/actions/admin-catalog';
import { PHOTO_ACCEPT, uploadProductPhoto } from '@/lib/upload-photo';
import type { ProductImage as Img } from '@/lib/types';
import { PhotoGrid } from './PhotoGrid';
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

  async function onFiles(files: File[]) {
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
          <p className="text-xs text-muted">The first photo is the cover. Drag photos to change the order. JPG, PNG, WebP or AVIF up to 5 MB each, up to 20 photos.</p>
        </div>
        <label className={`btn btn-outline btn-sm ${busy ? 'pointer-events-none opacity-60' : ''}`}>
          {busy ? 'Uploading…' : 'Add photos'}
          <input type="file" accept={PHOTO_ACCEPT} multiple className="sr-only" onChange={(e) => { const f = [...(e.target.files ?? [])]; e.target.value = ''; void onFiles(f); }} disabled={busy} />
        </label>
      </div>
      {message && <p className="text-sm text-muted" role="status">{message}</p>}
      <PhotoGrid
        photos={list.map((img) => ({ key: img.id, path: img.storage_path, alt: img.alt ?? '' }))}
        productName={productName}
        busy={busy}
        dragging={dragging}
        handlers={handlers}
        onAdd={(files) => void onFiles(files)}
        onRemove={(i) => run(() => deleteImage(list[i]!.id))}
        onMove={(i, d) => run(() => moveImage(list[i]!.id, d < 0 ? 'up' : 'down'))}
      />
    </section>
  );
}
