import { createHash } from 'node:crypto';

/**
 * Meta's customer-information rules: trim, lowercase, then SHA-256 (hex).
 * Phone numbers: digits only with the country code (8801XXXXXXXXX).
 * https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/customer-information-parameters
 */
export const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

export function normEmail(v: string) {
  return v.trim().toLowerCase();
}

export function normPhoneBd(local11: string): string | null {
  const d = local11.replace(/\D/g, '');
  if (/^01[3-9]\d{8}$/.test(d)) return `88${d}`;
  if (/^8801[3-9]\d{8}$/.test(d)) return d;
  return null;
}

/** First and last name for fn / ln (letters only, lowercase; Bangla letters kept). */
export function splitName(full: string): { fn: string | null; ln: string | null } {
  const parts = full.trim().toLowerCase().split(/\s+/).map((p) => p.replace(/[^\p{L}]/gu, '')).filter(Boolean);
  if (parts.length === 0) return { fn: null, ln: null };
  return { fn: parts[0] ?? null, ln: parts.length > 1 ? (parts[parts.length - 1] ?? null) : null };
}

/** City: lowercase, letters only, no spaces ("Cox's Bazar" → "coxsbazar"). */
export function normCity(v: string): string | null {
  const c = v.toLowerCase().replace(/[^\p{L}]/gu, '');
  return c || null;
}

/** Hashes what is present; omits what is not (Meta rejects empty strings). */
export function hashedUserData(input: { phone: string; name: string; district: string }) {
  const ph = normPhoneBd(input.phone);
  const { fn, ln } = splitName(input.name);
  const ct = normCity(input.district);
  return {
    ...(ph ? { ph: [sha256(ph)], external_id: [sha256(ph)] } : {}),
    ...(fn ? { fn: [sha256(fn)] } : {}),
    ...(ln ? { ln: [sha256(ln)] } : {}),
    ...(ct ? { ct: [sha256(ct)] } : {}),
    country: [sha256('bd')],
  };
}
