'use client';

import { useRouter } from 'next/navigation';
import { useState, type ChangeEvent } from 'react';
import { setLogo } from '@/actions/admin-settings';
import { IMAGE_BUCKET, imageUrl } from '@/lib/env';
import { getBrowserClient } from '@/lib/supabase/browser';

const TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/avif': 'avif' };

/** Upload your own logo file. Until then the shop shows the store name as text. */
export function LogoUploader({ path }: { path: string | null }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const url = imageUrl(path);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const ext = TYPES[file.type];
    if (!ext || file.size > 2 * 1024 * 1024) {
      setMsg('Use a PNG, JPG, WebP or AVIF under 2 MB.');
      return;
    }
    setBusy(true);
    const newPath = `brand/${crypto.randomUUID()}.${ext}`;
    const { error } = await getBrowserClient().storage.from(IMAGE_BUCKET).upload(newPath, file, { contentType: file.type, upsert: false });
    if (error) {
      setBusy(false);
      setMsg(`Upload failed: ${error.message}`);
      return;
    }
    const res = await setLogo(newPath);
    setBusy(false);
    setMsg(res.message ?? null);
    router.refresh();
  }

  return (
    <section className="card flex flex-wrap items-center gap-4 p-5">
      <div className="flex h-16 w-44 items-center justify-center rounded-xl border border-dashed border-line bg-paper">
        {url ? <img src={url} alt="Current logo" className="max-h-12 max-w-40 object-contain" /> : <span className="text-xs text-muted">No logo — name shown</span>}
      </div>
      <div className="flex-1 space-y-1">
        <h2 className="font-semibold">Logo</h2>
        <p className="text-xs text-muted">Wide PNG with a transparent background works best (around 280 × 80 px).</p>
        {msg && <p className="text-sm text-muted" role="status">{msg}</p>}
      </div>
      <div className="flex gap-2">
        <label className={`btn btn-outline btn-sm ${busy ? 'pointer-events-none opacity-60' : ''}`}>
          {busy ? 'Uploading…' : url ? 'Replace' : 'Upload logo'}
          <input type="file" accept="image/png,image/jpeg,image/webp,image/avif" className="sr-only" onChange={onFile} />
        </label>
        {url && (
          <button type="button" className="btn btn-ghost btn-sm text-bad" onClick={async () => { const r = await setLogo(null); setMsg(r.message ?? null); router.refresh(); }}>
            Remove
          </button>
        )}
      </div>
    </section>
  );
}
