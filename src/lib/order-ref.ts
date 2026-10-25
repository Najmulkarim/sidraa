/** Order numbers: "Order0001" now, "SD-33WH-WMKC" for orders placed before the change. */
export function canonicalRef(raw: string): string | null {
  const v = raw.trim();
  const n = /^order(\d{4,})$/i.exec(v);
  if (n) return `Order${n[1]}`;
  if (/^[A-Z]{2,4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/i.test(v)) return v.toUpperCase();
  return null;
}
