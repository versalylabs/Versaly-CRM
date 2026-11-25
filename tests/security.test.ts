import { describe, expect, it, beforeAll, vi } from 'vitest';

// lib/stages imports the Prisma client; these tests only use its pure helpers.
vi.mock('../lib/prisma', () => ({ default: {} }));

import { createAccountToken, passwordStamp, readAccountToken } from '../lib/accountTokens';
import { isPrivateAddress, publicHostError, webhookUrlError } from '../lib/safeUrl';
import { advanceStage, groupStages } from '../lib/stages';
import { checkMemoryRateLimit } from '../lib/rateLimit';
import { createInviteToken, verifyInviteToken } from '../lib/invitationToken';
import { PLANS, PLAN_ORDER, annualSavingsKes, planHasFeature } from '../lib/plans';

beforeAll(() => {
  process.env.NEXTAUTH_SECRET = 'x'.repeat(40);
});

describe('account tokens (password reset / email verification)', () => {
  it('round-trips for the right purpose only', () => {
    const t = createAccountToken('reset', 'user-1', 'stamp', 60_000);
    expect(readAccountToken(t, 'reset')).toEqual({ userId: 'user-1', stamp: 'stamp' });
    expect(readAccountToken(t, 'verify')).toBeNull();
  });
  it('rejects tampered, expired and malformed tokens', () => {
    const t = createAccountToken('verify', 'user-1', 'a@b.co', 60_000);
    expect(readAccountToken(t.slice(0, -2) + 'xx', 'verify')).toBeNull();
    expect(readAccountToken(createAccountToken('verify', 'user-1', 'a@b.co', -1), 'verify')).toBeNull();
    expect(readAccountToken('nonsense', 'verify')).toBeNull();
  });
  it('reset links die when the password changes', () => {
    expect(passwordStamp('hash-1')).not.toEqual(passwordStamp('hash-2'));
    expect(passwordStamp('hash-1')).toEqual(passwordStamp('hash-1'));
  });
  it('a token signed with another secret is refused', () => {
    const t = createAccountToken('reset', 'u', 's', 60_000);
    process.env.NEXTAUTH_SECRET = 'y'.repeat(40);
    expect(readAccountToken(t, 'reset')).toBeNull();
    process.env.NEXTAUTH_SECRET = 'x'.repeat(40);
  });
});

describe('invite tokens', () => {
  it('round-trips and refuses tampering', () => {
    const t = createInviteToken({ organizationId: 'o', organizationName: 'O', email: 'a@b.co', role: 'AGENT', expiresAt: Date.now() + 60_000 });
    expect(verifyInviteToken(t)?.email).toBe('a@b.co');
    expect(verifyInviteToken(t + 'x')).toBeNull();
  });
});

describe('SSRF protection', () => {
  it.each(['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '0.0.0.0', '::1', 'fd00::1', '::ffff:10.0.0.1'])(
    'blocks private address %s',
    (ip) => expect(isPrivateAddress(ip)).toBe(true),
  );
  it.each(['8.8.8.8', '102.68.10.1', '172.32.0.1'])('allows public address %s', (ip) => expect(isPrivateAddress(ip)).toBe(false));
  it('rejects localhost, private IPs and plain http for webhooks', async () => {
    expect(await publicHostError('localhost')).not.toBeNull();
    expect(await publicHostError('10.0.0.5')).not.toBeNull();
    expect(await webhookUrlError('http://example.com/hook')).toMatch(/https/);
    expect(await webhookUrlError('https://169.254.169.254/latest')).not.toBeNull();
    expect(await webhookUrlError('not a url')).not.toBeNull();
  });
});

describe('pipeline stages', () => {
  const custom = groupStages([
    { key: 'ENQUIRY', category: 'ACTIVE' },
    { key: 'CONTACTED', category: 'ACTIVE' },
    { key: 'PAID', category: 'WON' },
    { key: 'DROPPED', category: 'LOST' },
  ]);
  it('falls back to the default stages', () => {
    const d = groupStages([]);
    expect(d.all[0]).toBe('NEW_LEAD');
    expect(d.won).toContain('WON');
    expect(d.lost).toContain('LOST');
  });
  it('groups custom stages by category', () => {
    expect(custom).toEqual({ all: ['ENQUIRY', 'CONTACTED', 'PAID', 'DROPPED'], active: ['ENQUIRY', 'CONTACTED'], won: ['PAID'], lost: ['DROPPED'] });
  });
  it('only moves a lead forward, from an active stage, to a stage that exists', () => {
    expect(advanceStage(custom, 'ENQUIRY', 'CONTACTED')).toBe('CONTACTED');
    expect(advanceStage(custom, 'CONTACTED', 'CONTACTED')).toBeUndefined();
    expect(advanceStage(custom, 'PAID', 'CONTACTED')).toBeUndefined();
    expect(advanceStage(custom, 'ENQUIRY', 'FOLLOW_UP')).toBeUndefined();
  });
});

describe('rate limiter fallback', () => {
  it('allows up to the limit in a window, then blocks', () => {
    const key = `test-${Math.random()}`;
    const results = Array.from({ length: 4 }, () => checkMemoryRateLimit(key, 3, 60_000).allowed);
    expect(results).toEqual([true, true, true, false]);
  });
});

describe('plans', () => {
  it('annual saving matches the monthly/annual price gap', () => {
    expect(annualSavingsKes(PLANS.STARTER)).toBe((3900 - 3200) * 12);
  });
  it('each higher plan includes everything the lower ones do', () => {
    expect(planHasFeature('SOLO', 'email_inbox')).toBe(false);
    expect(planHasFeature('STARTER', 'email_inbox')).toBe(true);
    expect(planHasFeature('STARTER', 'whatsapp')).toBe(false);
    expect(planHasFeature('GROWTH_PRO', 'whatsapp')).toBe(true);
    expect(planHasFeature('ENTERPRISE', 'developer_api')).toBe(true);
  });
  it('unknown plan values fall back to Growth Pro', () => {
    expect(planHasFeature(undefined, 'whatsapp')).toBe(true);
    expect(planHasFeature('BOGUS', 'developer_api')).toBe(true);
  });
  it('higher plans never have lower limits or prices', () => {
    for (let i = 1; i < PLAN_ORDER.length; i++) {
      const lower = PLANS[PLAN_ORDER[i - 1]];
      const higher = PLANS[PLAN_ORDER[i]];
      expect(higher.leadLimit).toBeGreaterThan(lower.leadLimit);
      expect(higher.seatLimit).toBeGreaterThan(lower.seatLimit);
      expect(higher.priceKes.annual).toBeGreaterThan(lower.priceKes.annual);
      expect(higher.priceKes.monthly).toBeGreaterThan(higher.priceKes.annual);
    }
  });
});
