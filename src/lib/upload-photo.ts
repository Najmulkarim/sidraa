'use client';

import { IMAGE_BUCKET } from '@/lib/env';
import { getBrowserClient } from '@/lib/supabase/browser';

const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' };
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
/** Photos bigger than this are made smaller in the browser before upload. */
const SHRINK_OVER_BYTES = 350 * 1024;

/**
 * Makes a big photo smaller before it is stored: at most maxSide px on its
 * longest side, as WebP (keeps transparency). Each stored photo is downloaded
 * again whenever the site makes a new size of it, so a 3 MB original costs
 * ten times what a 300 KB one does. Small photos, and anything the browser
 * cannot read, are uploaded unchanged.
 */
export async function shrinkPhoto(file: File, maxSide = 1600): Promise<File> {
  if (file.size <= SHRINK_OVER_BYTES || !('createImageBitmap' in window)) return file;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/webp', 0.82));
    // Some browsers cannot write WebP and hand back a PNG: keep whichever is smaller.
    if (!blob || blob.type !== 'image/webp' || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[a-z0-9]+$/i, '') + '.webp', { type: 'image/webp' });
  } catch {
    return file;
  }
}
export const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp,image/avif';

/**
 * Uploads one product photo straight from the browser to Supabase Storage
 * with the admin's own session (the bucket policy checks the permission;
 * the bucket rejects non-images and files over 5 MB).
 */
export async function uploadProductPhoto(productId: string, original: File): Promise<{ path: string } | { error: string }> {
  if (!TYPES[original.type]) return { error: `${original.name}: use JPG, PNG, WebP or AVIF.` };
  const file = await shrinkPhoto(original);
  const ext = TYPES[file.type];
  if (!ext) return { error: `${file.name}: use JPG, PNG, WebP or AVIF.` };
  if (file.size > MAX_PHOTO_BYTES) return { error: `${file.name}: larger than 5 MB.` };
  const path = `products/${productId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await getBrowserClient().storage.from(IMAGE_BUCKET).upload(path, file, { contentType: file.type, cacheControl: '31536000', upsert: false });
  return error ? { error: `${file.name}: upload failed (${error.message}).` } : { path };
}

/** Home page builder pictures (banners, slides, feature photos) go under home/. */
export async function uploadHomeImage(original: File): Promise<{ path: string } | { error: string }> {
  if (!TYPES[original.type]) return { error: `${original.name}: use JPG, PNG, WebP or AVIF.` };
  // Banners can fill a wide screen: a little more room than product photos.
  const file = await shrinkPhoto(original, 2400);
  const ext = TYPES[file.type];
  if (!ext) return { error: `${file.name}: use JPG, PNG, WebP or AVIF.` };
  if (file.size > MAX_PHOTO_BYTES) return { error: `${file.name}: larger than 5 MB.` };
  const path = `home/${crypto.randomUUID()}.${ext}`;
  const { error } = await getBrowserClient().storage.from(IMAGE_BUCKET).upload(path, file, { contentType: file.type, cacheControl: '31536000', upsert: false });
  return error ? { error: `${file.name}: upload failed (${error.message}).` } : { path };
}

export async function removeUploadedPhoto(path: string) {
  await getBrowserClient().storage.from(IMAGE_BUCKET).remove([path]);
}
