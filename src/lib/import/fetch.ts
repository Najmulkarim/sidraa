import 'server-only';
import { lookup } from 'node:dns/promises';
import { isBlockedAddress } from './address';

const UA = 'Mozilla/5.0 (compatible; SidraaProductImport/1.0)';

export class ImportError extends Error {}

/** A public http(s) address only: staff must not be able to reach the server's own network through this. */
async function assertPublic(url: URL) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new ImportError('Use a link that starts with http or https.');
  if (url.port && !['80', '443'].includes(url.port)) throw new ImportError('That link cannot be used.');
  let addresses: { address: string }[];
  try {
    addresses = await lookup(url.hostname, { all: true });
  } catch {
    throw new ImportError('That website could not be found. Check the link.');
  }
  if (!addresses.length || addresses.some((a) => isBlockedAddress(a.address))) throw new ImportError('That link cannot be used.');
}

/** Follows redirects by hand so each hop is checked. Stops reading at maxBytes. */
export async function safeFetch(start: string, { accept, maxBytes, timeoutMs = 15_000, referer }: { accept: string; maxBytes: number; timeoutMs?: number; referer?: string }): Promise<{ url: string; type: string; bytes: Buffer }> {
  let url: URL;
  try {
    url = new URL(start);
  } catch {
    throw new ImportError('That is not a valid link.');
  }
  for (let hop = 0; hop < 5; hop++) {
    await assertPublic(url);
    let res: Response;
    try {
      res = await fetch(url, { redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(timeoutMs), headers: { 'User-Agent': UA, Accept: accept, ...(referer ? { Referer: referer } : {}) } });
    } catch {
      throw new ImportError('That website did not answer in time.');
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = new URL(res.headers.get('location')!, url);
      continue;
    }
    if (res.status === 401 || res.status === 403 || res.status === 429 || res.status === 503) throw new ImportError('That website blocks automatic reading. Add this product by hand.');
    if (!res.ok || !res.body) throw new ImportError(`That page could not be opened (error ${res.status}).`);
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxBytes) {
        await reader.cancel();
        throw new ImportError('That file is too large.');
      }
      chunks.push(value);
    }
    return { url: url.href, type: (res.headers.get('content-type') ?? '').toLowerCase(), bytes: Buffer.concat(chunks) };
  }
  throw new ImportError('That link redirects too many times.');
}

/** The real type of an image, from its first bytes; only what the photo bucket accepts. */
export function imageType(b: Buffer): { type: string; ext: string } | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { type: 'image/jpeg', ext: 'jpg' };
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { type: 'image/png', ext: 'png' };
  if (b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return { type: 'image/webp', ext: 'webp' };
  if (b.subarray(4, 8).toString('latin1') === 'ftyp' && /^avi[fs]/.test(b.subarray(8, 12).toString('latin1'))) return { type: 'image/avif', ext: 'avif' };
  return null;
}
