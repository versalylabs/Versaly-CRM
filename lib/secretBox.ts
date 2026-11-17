import crypto from 'crypto';
import { getAuthSecret } from './authSecret';

/**
 * AES-256-GCM encryption for credentials stored in the database
 * (channel access tokens, app secrets, refresh tokens).
 *
 * Key: CHANNEL_ENCRYPTION_KEY (32 bytes as hex or base64). If it is not set the
 * key is derived from NEXTAUTH_SECRET. Rotating the key requires re-saving the
 * connected accounts, so prefer setting a dedicated CHANNEL_ENCRYPTION_KEY.
 */
const PREFIX = 'enc:v1:';

function getKey(): Buffer {
  const raw = process.env.CHANNEL_ENCRYPTION_KEY?.trim();
  if (raw) {
    if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
    const asB64 = Buffer.from(raw, 'base64');
    if (asB64.length === 32) return asB64;
    throw new Error('CHANNEL_ENCRYPTION_KEY must be 32 bytes encoded as 64 hex characters or base64.');
  }
  return crypto.createHash('sha256').update(`versaly-channel-credentials:${getAuthSecret()}`).digest();
}

export function isEncrypted(value?: string | null): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

export function encryptSecret(plain?: string | null): string | null {
  if (!plain) return null;
  if (isEncrypted(plain)) return plain;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
}

/** Decrypts a stored value. Legacy plaintext values are returned unchanged. */
export function decryptSecret(stored?: string | null): string | null {
  if (!stored) return null;
  if (!isEncrypted(stored)) return stored;
  try {
    const [iv, tag, ct] = stored.slice(PREFIX.length).split(':').map((p) => Buffer.from(p, 'base64'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
  } catch {
    return null; // wrong key or corrupted value: treat as "not connected"
  }
}

export function generateWebhookSecret(): string {
  return `whsec_${crypto.randomBytes(24).toString('hex')}`;
}
