'use client';

import { IMAGE_BUCKET } from '@/lib/env';
import { getBrowserClient } from '@/lib/supabase/browser';

const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' };
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp,image/avif';

/**
 * Uploads one product photo straight from the browser to Supabase Storage
 * with the admin's own session (the bucket policy checks the permission;
 * the bucket rejects non-images and files over 5 MB).
 */
export async function uploadProductPhoto(productId: string, file: File): Promise<{ path: string } | { error: string }> {
  const ext = TYPES[file.type];
  if (!ext) return { error: `${file.name}: use JPG, PNG, WebP or AVIF.` };
  if (file.size > MAX_PHOTO_BYTES) return { error: `${file.name}: larger than 5 MB.` };
  const path = `products/${productId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await getBrowserClient().storage.from(IMAGE_BUCKET).upload(path, file, { contentType: file.type, cacheControl: '31536000', upsert: false });
  return error ? { error: `${file.name}: upload failed (${error.message}).` } : { path };
}

/** Home page builder pictures (banners, slides, feature photos) go under home/. */
export async function uploadHomeImage(file: File): Promise<{ path: string } | { error: string }> {
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
