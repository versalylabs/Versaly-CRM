import crypto from 'crypto';
import prisma from './prisma';

export const API_KEY_PREFIX = 'str_live_';

export function createApiKeySecret() {
  return `${API_KEY_PREFIX}${crypto.randomBytes(24).toString('hex')}`;
}
export function hashApiKey(key: string) { return crypto.createHash('sha256').update(key).digest('hex'); }
export function keyPrefix(key: string) { return key.slice(0, 16); }

export async function authenticateApiKey(key: string) {
  if (!key) return null;
  const record = await prisma.apiKey.findUnique({ where: { keyHash: hashApiKey(key) }, include: { organization: true } });
  if (!record || record.revokedAt || (record.expiresAt && record.expiresAt < new Date())) return null;
  await prisma.apiKey.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
  return record;
}

export async function emitWebhookEvent(organizationId: string, event: string, payload: unknown) {
  const endpoints = await prisma.webhookEndpoint.findMany({ where: { organizationId, isActive: true } });
  if (!endpoints.length) return;
  for (const endpoint of endpoints) {
    const events = Array.isArray(endpoint.events) ? endpoint.events as string[] : [];
    if (!events.includes('*') && !events.includes(event)) continue;
    const body = JSON.stringify({ id: crypto.randomUUID(), event, createdAt: new Date().toISOString(), data: payload });
    const signature = crypto.createHmac('sha256', endpoint.secret).update(body).digest('hex');
    let statusCode: number | undefined; let response = ''; let success = false;
    try {
      const res = await fetch(endpoint.url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-versaly-event': event, 'x-versaly-signature': `sha256=${signature}` }, body, signal: AbortSignal.timeout(10000) });
      statusCode = res.status; response = (await res.text()).slice(0, 2000); success = res.ok;
    } catch (e: any) { response = String(e?.message || e).slice(0, 2000); }
    await prisma.webhookDelivery.create({ data: { organizationId, endpointId: endpoint.id, event, payload: JSON.parse(body), statusCode: statusCode ?? null, response, success, deliveredAt: success ? new Date() : null } });
    await prisma.webhookEndpoint.update({ where: { id: endpoint.id }, data: { lastDeliveredAt: success ? new Date() : undefined, failureCount: success ? 0 : { increment: 1 } } }).catch(() => undefined);
  }
}

export function extractBearer(req: Request) {
  const auth = req.headers.get('authorization') || '';
  return auth.replace(/^Bearer\s+/i, '').trim() || req.headers.get('x-api-key') || '';
}
