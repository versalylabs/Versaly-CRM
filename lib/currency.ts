export const DEFAULT_CURRENCY = 'KES';

export function formatCurrency(value: number | null | undefined, currency?: string) {
  const code = currency || DEFAULT_CURRENCY;
  return new Intl.NumberFormat(code === 'KES' ? 'en-KE' : 'en-US', {
    style: 'currency',
    currency: code,
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}
