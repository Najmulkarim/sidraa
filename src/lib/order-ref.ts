/** Order numbers: "Order0001" or a custom capitals prefix ("SDR0001"), and "SD-33WH-WMKC" for very old orders. */
export function canonicalRef(raw: string): string | null {
  const v = raw.trim();
  const n = /^([a-z]{2,10})(\d{4,})$/i.exec(v);
  if (n) return n[1]!.toLowerCase() === 'order' ? `Order${n[2]}` : `${n[1]!.toUpperCase()}${n[2]}`;
  if (/^[A-Z]{2,4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/i.test(v)) return v.toUpperCase();
  return null;
}
