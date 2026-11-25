import prisma from './prisma';
import { decryptSecret } from './secretBox';

/**
 * WhatsApp Cloud API helpers beyond plain text sending (which lives in the WhatsApp provider):
 * delivery statuses, media, the 24-hour customer-service window, templates, Embedded Signup and a cost estimate.
 */

export const GRAPH = () => `https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_API_VERSION || 'v21.0'}`;
const WINDOW_MS = 24 * 3600_000;

/* ------------------------------ pure helpers ------------------------------ */

/** True while the customer wrote to us in the last 24 hours, so free-form replies are allowed. */
export function windowOpen(lastInbound: Date | null | undefined, now = new Date()) {
  return Boolean(lastInbound && now.getTime() - lastInbound.getTime() < WINDOW_MS);
}

const RANK: Record<string, number> = { QUEUED: 0, SENT: 1, DELIVERED: 2, READ: 3 };
/** Statuses arrive out of order; never move a message backwards (FAILED always wins). */
export function nextDeliveryStatus(current: string, incoming: string): string {
  const next = incoming.toUpperCase();
  if (next === 'FAILED') return 'FAILED';
  if (current === 'FAILED') return current;
  return (RANK[next] ?? -1) > (RANK[current] ?? -1) ? next : current;
}

/** Template body parameters: "Hi {{1}}, your balance is {{2}}" -> 2. */
export const templateParamCount = (body: string) => new Set(body.match(/\{\{\d+\}\}/g) || []).size;

export function fillTemplate(body: string, params: string[]) {
  return body.replace(/\{\{(\d+)\}\}/g, (_, n) => params[Number(n) - 1] ?? `{{${n}}}`);
}

/**
 * Approximate Meta charges per delivered template message in Kenya (Rest of Africa rate card), in KES.
 * Service replies inside the 24-hour window are free.
 * shortcut: fixed estimates; check Meta's current rate card and update these when it changes.
 */
export const WHATSAPP_RATE_KES: Record<string, number> = { marketing: 2.9, utility: 0.55, authentication: 0.55, service: 0 };

export function estimateCost(counts: Record<string, number>) {
  return Math.round(Object.entries(counts).reduce((sum, [cat, n]) => sum + (WHATSAPP_RATE_KES[cat] ?? 0) * n, 0));
}

/* --------------------------- account + Graph API --------------------------- */

export async function getWhatsAppAccount(organizationId: string) {
  const a = await prisma.connectedChannelAccount.findFirst({ where: { organizationId, channel: 'WHATSAPP', status: 'CONNECTED' }, orderBy: { updatedAt: 'desc' } });
  if (!a) return null;
  return { ...a, token: decryptSecret(a.accessToken) || '', wabaId: ((a.metadata || {}) as any).wabaId as string | undefined };
}

async function graph<T = any>(path: string, token: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(`${GRAPH()}${path}`, {
    method: init?.method || (init?.body ? 'POST' : 'GET'),
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
    signal: AbortSignal.timeout(20000),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.error_user_msg || json?.error?.message || `WhatsApp request failed (${res.status}).`);
  return json as T;
}

export type Template = { name: string; language: string; status: string; category: string; body: string; params: number };

export async function listTemplates(organizationId: string): Promise<Template[]> {
  const acc = await getWhatsAppAccount(organizationId);
  if (!acc?.wabaId) throw new Error('Add your WhatsApp Business Account ID to manage templates.');
  const data = await graph<{ data: any[] }>(`/${acc.wabaId}/message_templates?fields=name,language,status,category,components&limit=200`, acc.token);
  return (data.data || []).map((t) => {
    const body = (t.components || []).find((c: any) => c.type === 'BODY')?.text || '';
    return { name: t.name, language: t.language, status: t.status, category: String(t.category || '').toLowerCase(), body, params: templateParamCount(body) };
  });
}

/** Submits a body-only template for Meta's review. Names: lowercase letters, numbers and underscores. */
export async function createTemplate(organizationId: string, input: { name: string; category: string; language: string; body: string; examples: string[] }) {
  const acc = await getWhatsAppAccount(organizationId);
  if (!acc?.wabaId) throw new Error('Add your WhatsApp Business Account ID to manage templates.');
  const component: any = { type: 'BODY', text: input.body };
  if (input.examples.length) component.example = { body_text: [input.examples] };
  return graph(`/${acc.wabaId}/message_templates`, acc.token, {
    body: { name: input.name, category: input.category.toUpperCase(), language: input.language, components: [component] },
  });
}

/** Downloads an inbound media file. Meta's media URLs expire, so the ID is resolved again each time. */
export async function fetchMedia(organizationId: string, mediaId: string) {
  const acc = await getWhatsAppAccount(organizationId);
  if (!acc) throw new Error('WhatsApp is not connected.');
  const meta = await graph<{ url: string; mime_type: string }>(`/${mediaId}`, acc.token);
  const file = await fetch(meta.url, { headers: { Authorization: `Bearer ${acc.token}` }, signal: AbortSignal.timeout(30000) });
  if (!file.ok || !file.body) throw new Error('Media is no longer available.');
  return { body: file.body, mime: meta.mime_type || file.headers.get('content-type') || 'application/octet-stream' };
}

/** Applies a delivery status webhook (sent / delivered / read / failed) to the message we stored. */
export async function applyStatus(organizationId: string, s: any) {
  if (!s?.id || !s?.status) return;
  const msg = await prisma.conversationMessage.findFirst({ where: { externalMessageId: String(s.id), conversation: { organizationId } } });
  if (!msg) return;
  const status = nextDeliveryStatus(msg.deliveryStatus, String(s.status));
  const meta = { ...((msg.metadata || {}) as any) };
  if (s.pricing?.category) meta.category = String(s.pricing.category).toLowerCase();
  if (s.errors?.[0]) meta.error = s.errors[0].error_data?.details || s.errors[0].title || 'Delivery failed';
  await prisma.conversationMessage.update({
    where: { id: msg.id },
    data: { deliveryStatus: status, status, metadata: meta, readAt: status === 'READ' && !msg.readAt ? new Date() : undefined },
  });
}

/* ----------------------------- Embedded Signup ----------------------------- */

export const embeddedSignupConfigured = () => Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);

/**
 * Finishes Meta's Embedded Signup: swaps the one-time code for a business token, subscribes our app to the
 * customer's WhatsApp Business Account (so webhooks arrive) and registers the phone number for the Cloud API.
 */
export async function completeEmbeddedSignup(code: string, wabaId: string, phoneNumberId: string) {
  const q = new URLSearchParams({ client_id: process.env.META_APP_ID!, client_secret: process.env.META_APP_SECRET!, code });
  const tokenRes = await fetch(`${GRAPH()}/oauth/access_token?${q}`, { cache: 'no-store', signal: AbortSignal.timeout(20000) });
  const tokenJson: any = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenJson.access_token) throw new Error(tokenJson?.error?.message || 'Meta did not accept the sign-up code.');
  const token: string = tokenJson.access_token;
  await graph(`/${wabaId}/subscribed_apps`, token, { method: 'POST', body: {} });
  const pin = String(Math.floor(100000 + Math.random() * 900000));
  // Registering an already-registered number fails harmlessly; the number still works.
  await graph(`/${phoneNumberId}/register`, token, { body: { messaging_product: 'whatsapp', pin } }).catch((e) => console.warn('WhatsApp register:', e.message));
  const phone = await graph<{ display_phone_number?: string; verified_name?: string }>(`/${phoneNumberId}?fields=display_phone_number,verified_name`, token).catch(() => ({} as any));
  return { token, pin, displayNumber: phone.display_phone_number || phoneNumberId, verifiedName: phone.verified_name || 'WhatsApp Business' };
}
