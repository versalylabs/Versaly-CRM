import { lookup } from 'dns/promises';
import net from 'net';

/**
 * Protects against SSRF: workspace-supplied hosts (webhook URLs, IMAP/SMTP servers) must resolve
 * only to public internet addresses, never to localhost, private networks or cloud metadata.
 */
export function isPrivateAddress(ip: string): boolean {
  const v4 = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  if (net.isIPv4(v4)) {
    const [a, b] = v4.split('.').map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
      (a === 169 && b === 254) || // link-local, incl. cloud metadata 169.254.169.254
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224 // multicast and reserved
    );
  }
  const v6 = ip.toLowerCase();
  return v6 === '::' || v6 === '::1' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80') || v6.startsWith('ff');
}

/** Returns an error message when the host is not a public internet host, otherwise null. */
export async function publicHostError(hostname: string): Promise<string | null> {
  const host = hostname.trim().replace(/^\[|\]$/g, '').toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) {
    return 'That address points to a private network and is not allowed.';
  }
  if (net.isIP(host)) return isPrivateAddress(host) ? 'That address points to a private network and is not allowed.' : null;
  try {
    const addresses = await lookup(host, { all: true });
    if (!addresses.length) return 'That host name could not be found.';
    if (addresses.some((a) => isPrivateAddress(a.address))) return 'That address points to a private network and is not allowed.';
    return null;
  } catch {
    return 'That host name could not be found.';
  }
}

/** Webhook URLs must be HTTPS and public. */
export async function webhookUrlError(url: string): Promise<string | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return 'Enter a valid webhook URL.';
  }
  if (parsed.protocol !== 'https:') return 'Webhook URLs must start with https://';
  return publicHostError(parsed.hostname);
}
