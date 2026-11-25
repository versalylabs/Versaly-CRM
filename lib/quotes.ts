/**
 * Quote and invoice maths, shared by the API (which always recalculates) and the editor (live totals).
 * Unit prices exclude VAT; each line has a KRA tax type:
 *   B = VAT 16%, E = VAT 8%, C = zero-rated (0%), A = exempt, D = not subject to VAT.
 * Browser-safe: no database or Node imports here.
 */

export type TaxType = 'A' | 'B' | 'C' | 'D' | 'E';
export const TAX_TYPES: Record<TaxType, { label: string; rate: number }> = {
  B: { label: 'VAT 16%', rate: 16 },
  E: { label: 'VAT 8%', rate: 8 },
  C: { label: 'Zero-rated (0%)', rate: 0 },
  A: { label: 'Exempt', rate: 0 },
  D: { label: 'No VAT', rate: 0 },
};

export type LineItem = { description: string; quantity: number; unitPrice: number; discountPct: number; taxType: TaxType };
export type PricedLine = LineItem & { net: number; vat: number; total: number };

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Validates and cleans line items from a request. Throws a readable error. */
export function parseItems(input: unknown): LineItem[] {
  if (!Array.isArray(input) || input.length === 0) throw new Error('Add at least one line item.');
  if (input.length > 100) throw new Error('A document can have up to 100 lines.');
  return input.map((raw: any, i) => {
    const description = String(raw?.description || '').trim().slice(0, 300);
    const quantity = Number(raw?.quantity);
    const unitPrice = Number(raw?.unitPrice);
    const discountPct = raw?.discountPct === undefined || raw?.discountPct === '' ? 0 : Number(raw.discountPct);
    const taxType = (String(raw?.taxType || 'B').toUpperCase() in TAX_TYPES ? String(raw?.taxType || 'B').toUpperCase() : 'B') as TaxType;
    if (!description) throw new Error(`Line ${i + 1}: add a description.`);
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000) throw new Error(`Line ${i + 1}: quantity must be above 0.`);
    if (!Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 1_000_000_000) throw new Error(`Line ${i + 1}: enter a valid price.`);
    if (!Number.isFinite(discountPct) || discountPct < 0 || discountPct > 100) throw new Error(`Line ${i + 1}: discount must be 0 to 100%.`);
    return { description, quantity, unitPrice: round2(unitPrice), discountPct, taxType };
  });
}

/** Line and document totals. VAT is worked out per line and rounded to the cent. */
export function priceItems(items: LineItem[]) {
  const lines: PricedLine[] = items.map((it) => {
    const net = round2(it.quantity * it.unitPrice * (1 - it.discountPct / 100));
    const vat = round2((net * TAX_TYPES[it.taxType].rate) / 100);
    return { ...it, net, vat, total: round2(net + vat) };
  });
  const subtotal = round2(lines.reduce((s, l) => s + l.net, 0));
  const vatTotal = round2(lines.reduce((s, l) => s + l.vat, 0));
  return { lines, subtotal, vatTotal, total: round2(subtotal + vatTotal) };
}

export const docNumber = (prefix: 'Q' | 'INV' | 'CN', seq: number) => `${prefix}-${String(seq).padStart(4, '0')}`;

/** What a customer sees: part-paid and overdue are worked out, not stored. */
export function invoiceStatus(inv: { status: string; total: number; amountPaid: number; dueDate: Date | string | null; kind?: string }, now = new Date()) {
  if (inv.status === 'VOID') return 'VOID';
  if (inv.kind === 'CREDIT_NOTE') return 'ISSUED';
  if (inv.total > 0 && inv.amountPaid >= inv.total - 0.005) return 'PAID';
  if (inv.status === 'DRAFT') return 'DRAFT';
  if (inv.dueDate && new Date(inv.dueDate).getTime() < now.getTime() - 86_400_000) return inv.amountPaid > 0 ? 'PART_PAID_OVERDUE' : 'OVERDUE';
  return inv.amountPaid > 0 ? 'PART_PAID' : 'SENT';
}

export const balanceDue = (inv: { total: number; amountPaid: number }) => Math.max(0, round2(inv.total - inv.amountPaid));
