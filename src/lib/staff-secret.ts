import 'server-only';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Encrypts the staff passwords the owner sets (table staff_passwords), so a super
 * admin can look one up later. AES-256-GCM; the key is derived from the server's
 * RATE_LIMIT_SALT and is never stored in the database. If that secret is ever
 * changed, saved passwords can no longer be read (set new ones).
 */
function key(): Buffer {
  const salt = process.env.RATE_LIMIT_SALT;
  if (!salt || salt.length < 16) throw new Error('RATE_LIMIT_SALT must be set (32+ random characters).');
  return createHash('sha256').update(`sidraa:staff-password:v1:${salt}`).digest();
}

export function sealPassword(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `v1.${Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64')}`;
}

export function openPassword(sealed: string): string | null {
  try {
    if (!sealed.startsWith('v1.')) return null;
    const raw = Buffer.from(sealed.slice(3), 'base64');
    const decipher = createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
