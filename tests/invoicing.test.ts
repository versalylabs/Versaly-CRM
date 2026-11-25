import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/prisma', () => ({ default: {} }));

import { balanceDue, docNumber, invoiceStatus, parseItems, priceItems } from '../lib/quotes';
import { buildSalePayload, etimsItemCode, kraDate, receiptQrUrl } from '../lib/etims';

describe('quote and invoice maths', () => {
  it('prices lines with discount and per-line VAT, rounded to the cent', () => {
    const r = priceItems([
      { description: 'Design', quantity: 2, unitPrice: 10000, discountPct: 10, taxType: 'B' }, // 18,000 + 2,880 VAT
      { description: 'Training', quantity: 1, unitPrice: 5000, discountPct: 0, taxType: 'A' }, // exempt
      { description: 'Solar panel', quantity: 3, unitPrice: 333.33, discountPct: 0, taxType: 'E' }, // 999.99 + 80.00 (8%)
    ]);
    expect(r.lines.map((l) => [l.net, l.vat, l.total])).toEqual([[18000, 2880, 20880], [5000, 0, 5000], [999.99, 80, 1079.99]]);
    expect(r).toMatchObject({ subtotal: 23999.99, vatTotal: 2960, total: 26959.99 });
  });
  it('rejects bad lines with a readable message', () => {
    expect(() => parseItems([])).toThrow(/at least one/);
    expect(() => parseItems([{ description: '', quantity: 1, unitPrice: 1 }])).toThrow(/Line 1/);
    expect(() => parseItems([{ description: 'x', quantity: 0, unitPrice: 1 }])).toThrow(/quantity/);
    expect(() => parseItems([{ description: 'x', quantity: 1, unitPrice: 1, discountPct: 150 }])).toThrow(/discount/);
    expect(parseItems([{ description: ' x ', quantity: '2', unitPrice: '10.005', taxType: 'zz' }])[0]).toEqual({ description: 'x', quantity: 2, unitPrice: 10.01, discountPct: 0, taxType: 'B' });
  });
  it('numbers documents', () => {
    expect(docNumber('INV', 7)).toBe('INV-0007');
    expect(docNumber('Q', 12345)).toBe('Q-12345');
  });
});

describe('invoice status', () => {
  const now = new Date('2026-12-10T12:00:00Z');
  const base = { status: 'SENT', total: 1000, amountPaid: 0, dueDate: '2026-12-20' };
  it('derives paid, part-paid and overdue', () => {
    expect(invoiceStatus(base, now)).toBe('SENT');
    expect(invoiceStatus({ ...base, amountPaid: 400 }, now)).toBe('PART_PAID');
    expect(invoiceStatus({ ...base, dueDate: '2026-12-01' }, now)).toBe('OVERDUE');
    expect(invoiceStatus({ ...base, dueDate: '2026-12-01', amountPaid: 1 }, now)).toBe('PART_PAID_OVERDUE');
    expect(invoiceStatus({ ...base, amountPaid: 1000 }, now)).toBe('PAID');
    expect(invoiceStatus({ ...base, status: 'VOID', amountPaid: 1000 }, now)).toBe('VOID');
    expect(invoiceStatus({ ...base, status: 'DRAFT' }, now)).toBe('DRAFT');
    expect(balanceDue({ total: 1000, amountPaid: 1200 })).toBe(0);
  });
});

describe('KRA eTIMS sale payload', () => {
  const items = [
    { description: 'Design', quantity: 2, unitPrice: 10000, discountPct: 10, taxType: 'B' as const },
    { description: 'Training', quantity: 1, unitPrice: 5000, discountPct: 0, taxType: 'A' as const },
  ];
  const payload = buildSalePayload({
    tin: 'P051234567X', bhfId: '00', userName: 'Jane',
    invoice: { number: 'INV-0003', sequence: 3, kind: 'INVOICE', issueDate: new Date('2026-12-01T22:30:00Z'), items, paid: false },
    customer: { name: 'Acme Ltd', phone: '254712345678' }, seller: { name: 'Seller Ltd', address: 'Nairobi' },
  });
  it('sends VAT-inclusive totals grouped by tax type', () => {
    expect(payload).toMatchObject({ invcNo: 3, trdInvcNo: 'INV-0003', rcptTyCd: 'S', pmtTyCd: '02', salesDt: '20261202', totItemCnt: 2 });
    expect(payload).toMatchObject({ taxblAmtB: 20880, taxAmtB: 2880, taxRtB: 16, taxblAmtA: 5000, taxAmtA: 0, totTaxblAmt: 25880, totTaxAmt: 2880, totAmt: 25880 });
  });
  it('maps each line with an inclusive price, discount and registered item code', () => {
    expect(payload.itemList[0]).toMatchObject({ itemSeq: 1, itemCd: 'KE3NTU0000002', taxTyCd: 'B', qty: 2, prc: 11600, splyAmt: 23200, dcRt: 10, dcAmt: 2320, taxblAmt: 20880, taxAmt: 2880, totAmt: 20880 });
    expect(etimsItemCode('A')).toBe('KE3NTU0000001');
  });
  it('marks credit notes as refunds against the original invoice number', () => {
    const cn = buildSalePayload({
      tin: 'P051234567X', bhfId: '00', userName: 'Jane', originalSequence: 3,
      invoice: { number: 'CN-0004', sequence: 4, kind: 'CREDIT_NOTE', issueDate: new Date(), items, paid: true },
      customer: { name: 'Acme' }, seller: { name: 'Seller' },
    });
    expect(cn).toMatchObject({ rcptTyCd: 'R', orgInvcNo: 3, pmtTyCd: '06' });
  });
  it('formats Kenya-time dates and the KRA receipt link', () => {
    expect(kraDate(new Date('2026-12-31T21:15:09Z'), true)).toBe('20270101001509');
    expect(receiptQrUrl('sandbox', 'P051234567X', '00', 'SIG')).toBe('https://etims-sbx.kra.go.ke/common/link/etims/receipt/indexEtimsReceiptData?Data=P051234567X00SIG');
  });
});
