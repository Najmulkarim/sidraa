/**
 * CSV writer for admin exports. Quotes every field and neutralises
 * spreadsheet formula injection: a cell that starts with = + - @ tab or
 * carriage return is prefixed with an apostrophe, so a customer named
 * "=HYPERLINK(...)" cannot run anything when the file is opened in Excel.
 */
export type CsvValue = string | number | boolean | null | undefined;

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return '""';
  let s = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv(header: string[], rows: CsvValue[][]): string {
  const lines = [header.map(csvCell).join(','), ...rows.map((r) => r.map(csvCell).join(','))];
  // BOM so Excel opens UTF-8 (Bangla names, ৳) correctly.
  return `﻿${lines.join('\r\n')}\r\n`;
}
