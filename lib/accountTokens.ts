import crypto from 'crypto';
import { getAuthSecret } from './authSecret';

/**
 * Signed, expiring tokens for account emails (password reset, email verification).
 * No database table: the token carries the user id, a purpose and a `stamp`.
 * - reset: stamp = fingerprint of the current password hash, so a link stops working
 *   once the password changes (single use).
 * - verify: stamp = the email address the link was sent to.
 */
export type AccountTokenPurpose = 'reset' | 'verify';

type Payload = { uid: string; p: AccountTokenPurpose; s: string; exp: number };

const sign = (data: string) => crypto.createHmac('sha256', getAuthSecret()).update(`account:${data}`).digest('base64url');

export const passwordStamp = (passwordHash: string) =>
  crypto.createHash('sha256').update(passwordHash).digest('base64url').slice(0, 16);

export function createAccountToken(purpose: AccountTokenPurpose, userId: string, stamp: string, ttlMs: number): string {
  const payload: Payload = { uid: userId, p: purpose, s: stamp, exp: Date.now() + ttlMs };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${data}.${sign(data)}`;
}

export function readAccountToken(token: string, purpose: AccountTokenPurpose): { userId: string; stamp: string } | null {
  try {
    const [data, signature] = String(token || '').split('.');
    if (!data || !signature) return null;
    const expected = Buffer.from(sign(data));
    const given = Buffer.from(signature);
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as Payload;
    if (payload.p !== purpose || !payload.uid || Date.now() > payload.exp) return null;
    return { userId: payload.uid, stamp: payload.s };
  } catch {
    return null;
  }
}

export const VERIFY_TTL_MS = 3 * 24 * 60 * 60 * 1000;

export const appUrl = (fallbackOrigin: string) => (process.env.NEXTAUTH_URL || fallbackOrigin).replace(/\/$/, '');
