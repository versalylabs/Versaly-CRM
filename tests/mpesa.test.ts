import { describe, expect, it } from 'vitest';
import {
  ageingBucket,
  allocate,
  buildSchedule,
  chooseMatch,
  darajaTimestamp,
  mpesaPhone,
  newPaymentRef,
  parseC2BConfirmation,
  parseStkCallback,
  reminderStage,
  stkPassword,
} from '../lib/mpesa';

const d = (s: string) => new Date(s);

describe('Daraja request details', () => {
  it('formats the timestamp in Kenya time (UTC+3)', () => {
    expect(darajaTimestamp(d('2026-03-10T21:30:05Z'))).toBe('20260311003005');
  });
  it('builds the STK password as base64(shortcode + passkey + timestamp)', () => {
    expect(Buffer.from(stkPassword('174379', 'pk', '20260101000000'), 'base64').toString()).toBe('174379pk20260101000000');
  });
  it('accepts Safaricom numbers in local and international form only', () => {
    expect(mpesaPhone('0712 345 678')).toBe('254712345678');
    expect(mpesaPhone('+254 110 123 456')).toBe('254110123456');
    expect(mpesaPhone('0201234567')).toBeNull(); // landline
    expect(mpesaPhone('+447700900123')).toBeNull();
  });
  it('makes readable 6-character account references without ambiguous characters', () => {
    for (let i = 0; i < 50; i++) expect(newPaymentRef()).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  });
});

describe('Safaricom callbacks', () => {
  it('reads a successful STK result', () => {
    const r = parseStkCallback({ Body: { stkCallback: { CheckoutRequestID: 'ws_1', ResultCode: 0, ResultDesc: 'ok', CallbackMetadata: { Item: [
      { Name: 'Amount', Value: 1500.0 }, { Name: 'MpesaReceiptNumber', Value: 'QAB123' }, { Name: 'PhoneNumber', Value: 254712345678 },
    ] } } } });
    expect(r).toEqual({ checkoutRequestId: 'ws_1', resultCode: 0, resultDesc: 'ok', amount: 1500, receipt: 'QAB123', phone: '254712345678' });
  });
  it('reads a cancelled STK result and rejects junk', () => {
    expect(parseStkCallback({ Body: { stkCallback: { CheckoutRequestID: 'ws_2', ResultCode: 1032, ResultDesc: 'Cancelled by user' } } })?.resultCode).toBe(1032);
    expect(parseStkCallback({})).toBeNull();
  });
  it('reads a C2B confirmation and converts Kenya time to UTC', () => {
    const c = parseC2BConfirmation({ TransID: 'RKT1', TransTime: '20260311003005', TransAmount: '250.00', BusinessShortCode: '600000', BillRefNumber: ' ab12cd ', MSISDN: '254712345678', FirstName: 'Jane', LastName: 'Doe' });
    expect(c).toMatchObject({ receipt: 'RKT1', amount: 250, billRef: 'ab12cd', shortcode: '600000', payerName: 'Jane Doe' });
    expect(c!.paidAt.toISOString()).toBe('2026-03-10T21:30:05.000Z');
    expect(parseC2BConfirmation({ TransAmount: '1' })).toBeNull();
  });
});

describe('matching a payment to a customer', () => {
  it('prefers the account reference, then phone, then a unique amount', () => {
    expect(chooseMatch({ byReference: ['A'], byPhone: ['B'], byAmount: [{ paymentId: 'p', leadId: 'C' }] })).toEqual({ leadId: 'A', matchedBy: 'REFERENCE' });
    expect(chooseMatch({ byReference: [], byPhone: ['B'], byAmount: [] })).toEqual({ leadId: 'B', matchedBy: 'PHONE' });
    expect(chooseMatch({ byReference: [], byPhone: [], byAmount: [{ paymentId: 'p', leadId: 'C' }] })).toEqual({ leadId: 'C', matchedBy: 'AMOUNT', requestId: 'p' });
  });
  it('leaves it unmatched when a rule points at more than one customer', () => {
    expect(chooseMatch({ byReference: [], byPhone: ['B', 'D'], byAmount: [{ paymentId: 'p', leadId: 'C' }, { paymentId: 'q', leadId: 'E' }] })).toBeNull();
    expect(chooseMatch({ byReference: [], byPhone: [], byAmount: [] })).toBeNull();
  });
});

describe('instalment plans', () => {
  it('builds a deposit plus equal instalments, last one absorbing rounding', () => {
    const s = buildSchedule({ total: 10000, deposit: 1000, count: 4, firstDue: d('2026-01-15T00:00:00Z'), frequency: 'monthly' });
    expect(s.map((r) => r.amount)).toEqual([1000, 2250, 2250, 2250, 2250]);
    const odd = buildSchedule({ total: 1000, deposit: 0, count: 3, firstDue: d('2026-01-01T00:00:00Z'), frequency: 'weekly' });
    expect(odd.map((r) => r.amount)).toEqual([333, 333, 334]);
    expect(odd[2].dueDate.toISOString().slice(0, 10)).toBe('2026-01-15');
  });
  it('rejects nonsense plans', () => {
    expect(() => buildSchedule({ total: 100, deposit: 100, count: 1, firstDue: new Date(), frequency: 'monthly' })).toThrow();
    expect(() => buildSchedule({ total: 100, deposit: 0, count: 0, firstDue: new Date(), frequency: 'monthly' })).toThrow();
  });
  it('pays the oldest instalment first and reports what is left over', () => {
    const r = allocate([{ id: 'a', amount: 500, paidAmount: 500 }, { id: 'b', amount: 500, paidAmount: 200 }, { id: 'c', amount: 500, paidAmount: 0 }], 600);
    expect(r).toEqual({ updates: [{ id: 'b', paidAmount: 500 }, { id: 'c', paidAmount: 300 }], leftover: 0 });
    expect(allocate([{ id: 'a', amount: 100, paidAmount: 0 }], 250)).toEqual({ updates: [{ id: 'a', paidAmount: 100 }], leftover: 150 });
  });
});

describe('ageing and reminders', () => {
  const now = d('2026-06-30T09:00:00Z');
  it('buckets outstanding amounts by days late', () => {
    expect(ageingBucket(d('2026-07-05T00:00:00Z'), now)).toBe('current');
    expect(ageingBucket(d('2026-06-20T00:00:00Z'), now)).toBe('1-30');
    expect(ageingBucket(d('2026-05-15T00:00:00Z'), now)).toBe('31-60');
    expect(ageingBucket(d('2026-04-15T00:00:00Z'), now)).toBe('61-90');
    expect(ageingBucket(d('2026-01-01T00:00:00Z'), now)).toBe('90+');
  });
  it('reminds 3 days before, on the day, when late and when a week late', () => {
    expect(reminderStage(d('2026-07-05T00:00:00Z'), now)).toBeNull();
    expect(reminderStage(d('2026-07-03T00:00:00Z'), now)).toBe('BEFORE');
    expect(reminderStage(d('2026-06-30T23:00:00Z'), now)).toBe('DUE');
    expect(reminderStage(d('2026-06-28T00:00:00Z'), now)).toBe('OVERDUE');
    expect(reminderStage(d('2026-06-20T00:00:00Z'), now)).toBe('FINAL');
  });
});
