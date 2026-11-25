import crypto from 'crypto';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/prisma', () => ({ default: {} }));

import { billingNotice, nextPeriod, priceFor, verifyPaystackSignature } from '../lib/billing';

const d = (s: string) => new Date(s);

describe('prices', () => {
  it('charges the monthly price, or 12 x the annual monthly price', () => {
    expect(priceFor('STARTER', 'month')).toBe(3900);
    expect(priceFor('STARTER', 'year')).toBe(3200 * 12);
    expect(priceFor('SOLO', 'year')).toBe(1200 * 12);
  });
});

describe('billing periods', () => {
  it('starts from now when there is no current period or it has ended', () => {
    expect(nextPeriod(null, d('2026-03-10T10:00:00Z'), 'month').end.toISOString()).toBe('2026-04-10T10:00:00.000Z');
    expect(nextPeriod(d('2026-01-01T00:00:00Z'), d('2026-03-10T10:00:00Z'), 'year').end.toISOString()).toBe('2027-03-10T10:00:00.000Z');
  });
  it('early renewal extends from the current end, so no paid time is lost', () => {
    const p = nextPeriod(d('2026-05-01T00:00:00Z'), d('2026-04-20T00:00:00Z'), 'month');
    expect(p.start.toISOString()).toBe('2026-05-01T00:00:00.000Z');
    expect(p.end.toISOString()).toBe('2026-06-01T00:00:00.000Z');
  });
});

describe('Paystack webhook signature', () => {
  const secret = 'sk_test_example';
  const body = JSON.stringify({ event: 'charge.success', data: { reference: 'r1' } });
  const sig = crypto.createHmac('sha512', secret).update(body).digest('hex');
  it('accepts the correct HMAC-SHA512 signature', () => expect(verifyPaystackSignature(body, sig, secret)).toBe(true));
  it('rejects a wrong, missing or tampered signature', () => {
    expect(verifyPaystackSignature(body, 'abc', secret)).toBe(false);
    expect(verifyPaystackSignature(body, null, secret)).toBe(false);
    expect(verifyPaystackSignature(body.replace('r1', 'r2'), sig, secret)).toBe(false);
    expect(verifyPaystackSignature(body, sig, undefined)).toBe(false);
  });
});

describe('reminder schedule', () => {
  const now = d('2026-06-15T05:00:00Z');
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
  const inDays = (n: number) => new Date(now.getTime() + n * 86_400_000);
  const base = { planStatus: 'active', createdAt: daysAgo(100), currentPeriodEnd: null as Date | null, hasCard: false, autoRenew: true };

  it('trial reminders with 7 and 2 days left and on the last day', () => {
    expect(billingNotice({ ...base, planStatus: 'trialing', createdAt: daysAgo(7) }, now)).toEqual({ kind: 'trial', daysLeft: 7 });
    expect(billingNotice({ ...base, planStatus: 'trialing', createdAt: daysAgo(12) }, now)).toEqual({ kind: 'trial', daysLeft: 2 });
    expect(billingNotice({ ...base, planStatus: 'trialing', createdAt: daysAgo(14) }, now)).toEqual({ kind: 'trial', daysLeft: 0 });
    expect(billingNotice({ ...base, planStatus: 'trialing', createdAt: daysAgo(5) }, now)).toBeNull();
  });
  it('M-Pesa payers are reminded 7, 3 and 1 days before the end', () => {
    for (const n of [7, 3, 1]) expect(billingNotice({ ...base, currentPeriodEnd: inDays(n) }, now)).toEqual({ kind: 'renewal', daysLeft: n });
    expect(billingNotice({ ...base, currentPeriodEnd: inDays(5) }, now)).toBeNull();
  });
  it('card customers get one heads-up 3 days before the automatic charge', () => {
    expect(billingNotice({ ...base, hasCard: true, currentPeriodEnd: inDays(3) }, now)).toEqual({ kind: 'card-renewal', daysLeft: 3 });
    expect(billingNotice({ ...base, hasCard: true, currentPeriodEnd: inDays(7) }, now)).toBeNull();
  });
  it('a card customer who turned off auto-renew gets the M-Pesa style reminders', () => {
    expect(billingNotice({ ...base, hasCard: true, autoRenew: false, currentPeriodEnd: inDays(7) }, now)).toEqual({ kind: 'renewal', daysLeft: 7 });
  });
});
