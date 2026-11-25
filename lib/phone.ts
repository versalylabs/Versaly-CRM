/**
 * Normalises a phone number to international digits without "+", e.g. "0712 345 678" -> "254712345678".
 * Kenyan local formats (07..., 01..., 7..., 1...) get the 254 prefix; other international numbers are kept.
 * Returns null when it does not look like a phone number.
 */
export function normalizePhone(input: unknown): string | null {
  const raw = String(input ?? '').trim();
  if (!raw) return null;
  let digits = raw.replace(/[^\d]/g, '');
  if (raw.startsWith('+')) {
    // already international
  } else if (/^0[17]\d{8}$/.test(digits)) {
    digits = `254${digits.slice(1)}`;
  } else if (/^[17]\d{8}$/.test(digits)) {
    digits = `254${digits}`;
  }
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}
