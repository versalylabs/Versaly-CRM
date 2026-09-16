import crypto from 'crypto';

const SECRET = process.env.NEXTAUTH_SECRET || 'straten-crm-secret-salt-for-tokens-2026';

export type InvitePayload = {
  organizationId: string;
  organizationName: string;
  email: string;
  role: string;
  expiresAt: number;
};

export function createInviteToken(payload: InvitePayload): string {
  const dataStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', SECRET).update(dataStr).digest('base64url');
  return `${dataStr}.${signature}`;
}

export function verifyInviteToken(token: string): InvitePayload | null {
  try {
    const [dataStr, signature] = token.split('.');
    if (!dataStr || !signature) return null;
    const expectedSig = crypto.createHmac('sha256', SECRET).update(dataStr).digest('base64url');
    if (signature !== expectedSig) return null;
    const payload: InvitePayload = JSON.parse(Buffer.from(dataStr, 'base64url').toString('utf8'));
    if (Date.now() > payload.expiresAt) return null;
    return payload;
  } catch {
    return null;
  }
}
