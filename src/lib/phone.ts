/**
 * Bangladeshi mobile numbers. Mirrors public.normalize_bd_phone() in
 * supabase/migrations/0007_order_functions.sql — keep the two in step.
 *
 * Accepts 01XXXXXXXXX, +8801XXXXXXXXX or 8801XXXXXXXXX, with spaces or
 * dashes. Returns the 11-digit local form, or null.
 */
export function normalizeBdPhone(input: string | null | undefined): string | null {
  let digits = (input ?? '').replace(/\D/g, '');
  if (/^8801[3-9]\d{8}$/.test(digits)) digits = digits.slice(2);
  return /^01[3-9]\d{8}$/.test(digits) ? digits : null;
}

/** 01711222333 → 01711-222333 for display. */
export function formatBdPhone(phone: string): string {
  return /^\d{11}$/.test(phone) ? `${phone.slice(0, 5)}-${phone.slice(5)}` : phone;
}

/** 01711222333 → 017•••••333 for places where the full number is not needed. */
export function maskBdPhone(phone: string): string {
  return /^\d{11}$/.test(phone) ? `${phone.slice(0, 3)}•••••${phone.slice(8)}` : '•••';
}
