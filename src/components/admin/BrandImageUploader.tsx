'use client';

import { useRouter } from 'next/navigation';
import { useState, type ChangeEvent } from 'react';
import { setBrandImage } from '@/actions/admin-storefront';
import { IMAGE_BUCKET, imageUrl } from '@/lib/env';
import { getBrowserClient } from '@/lib/supabase/browser';
import { notify } from './Toaster';

const TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/avif': 'avif', 'image/x-icon': 'ico', 'image/vnd.microsoft.icon': 'ico' };

/** Favicon or Facebook share image: upload, replace, remove. */
export function BrandImageUploader({ kind, path, title, hint, box }: { kind: 'favicon' | 'og_image'; path: string | null; title: string; hint: string; box: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const url = imageUrl(path);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const ext = TYPES[file.type];
    if (!ext || file.size > 2 * 1024 * 1024) return notify(false, 'Use a PNG, JPG, WebP, AVIF or ICO under 2 MB.');
    setBusy(true);
    const newPath = `brand/${crypto.randomUUID()}.${ext}`;
    const { error } = await getBrowserClient().storage.from(IMAGE_BUCKET).upload(newPath, file, { contentType: file.type, upsert: false });
    if (error) {
      setBusy(false);
      return notify(false, `Upload failed: ${error.message}`);
    }
    const r = await setBrandImage(kind, newPath);
    setBusy(false);
    notify(r.ok, r.message);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-line p-4">
      <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-line bg-paper ${box}`}>
        {url ? <img src={url} alt="" className="max-h-full max-w-full object-contain" /> : <span className="px-2 text-center text-[11px] text-muted">None</span>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-[12.5px] text-muted">{hint}</p>
      </div>
      <div className="flex gap-2">
        <label className={`btn btn-outline btn-sm ${busy ? 'pointer-events-none opacity-60' : ''}`}>
          {busy ? 'Uploading…' : url ? 'Replace' : 'Upload'}
          <input type="file" accept="image/png,image/jpeg,image/webp,image/avif,image/x-icon" className="sr-only" onChange={onFile} />
        </label>
        {url && (
          <button type="button" className="btn btn-ghost btn-sm text-bad" onClick={async () => { const r = await setBrandImage(kind, null); notify(r.ok, r.message); router.refresh(); }}>
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
