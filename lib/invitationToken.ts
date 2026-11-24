import crypto from 'crypto';
import { getAuthSecret } from './authSecret';

// No fallback secret: a hard-coded value would let anyone forge an ADMIN invite.
const sign = (data: string) => crypto.createHmac('sha256', getAuthSecret()).update(data).digest('base64url');

export type InvitePayload = {
  organizationId: string;
  organizationName: string;
  email: string;
  role: string;
  expiresAt: number;
};

export function createInviteToken(payload: InvitePayload): string {
  const dataStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = sign(dataStr);
  return `${dataStr}.${signature}`;
}

export function verifyInviteToken(token: string): InvitePayload | null {
  try {
    const [dataStr, signature] = token.split('.');
    if (!dataStr || !signature) return null;
    const expected = Buffer.from(sign(dataStr));
    const given = Buffer.from(signature);
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
    const payload: InvitePayload = JSON.parse(Buffer.from(dataStr, 'base64url').toString('utf8'));
    if (Date.now() > payload.expiresAt) return null;
    return payload;
  } catch {
    return null;
  }
}
