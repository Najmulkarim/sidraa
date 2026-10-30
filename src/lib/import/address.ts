import { isIP } from 'node:net';

/** Private, local and otherwise non-public addresses, which an imported link must never reach. */
export function isBlockedAddress(address: string): boolean {
  const kind = isIP(address);
  if (kind === 0) return true;
  if (kind === 4) {
    const [a = 0, b = 0, c = 0] = address.split('.').map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0 && (c === 0 || c === 2)) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113)
    );
  }
  const v6 = address.toLowerCase();
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v6)?.[1];
  if (mapped) return isBlockedAddress(mapped);
  // Only ordinary global addresses (2000::/3), and not the documentation range.
  return !/^[23][0-9a-f]{3}:/.test(v6) || v6.startsWith('2001:db8');
}
