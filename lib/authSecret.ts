/**
 * Returns the secret used to sign/verify session JWTs.
 * There is intentionally NO fallback value: a hard-coded secret would let
 * anyone forge a session token. Fail loudly instead.
 */
export function getAuthSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET is not configured. Set a random value of at least 32 characters.');
  }
  return secret;
}
