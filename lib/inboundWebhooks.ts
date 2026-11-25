import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { recordInboundChannelMessage } from '@/lib/inbox';
import { decryptSecret } from '@/lib/secretBox';
import { providerRegistry } from '@/lib/communication-providers';
import { applyStatus } from '@/lib/whatsapp';

/**
 * Hardened inbound webhook handling shared by
 *   /api/inbox/webhook  and  /api/webhooks/communications/[channel]
 *
 * Rules:
 *  - The workspace is ALWAYS resolved from a connected channel account
 *    (page / phone-number / account id, or a per-account secret). It is never
 *    taken from the request body and there is no "default workspace" fallback.
 *  - Meta and X payloads must carry a valid HMAC signature.
 *  - Generic / TikTok / email payloads must carry the per-account webhook secret.
 */

type Channel = 'INSTAGRAM' | 'FACEBOOK' | 'WHATSAPP' | 'TIKTOK' | 'X' | 'EMAIL';
const GENERIC_CHANNELS: Channel[] = ['INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'X', 'WHATSAPP', 'EMAIL'];

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

function validHmac(raw: string, header: string | null, secrets: Array<string | null | undefined>, encoding: 'hex' | 'base64') {
  if (!header) return false;
  const provided = header.replace(/^sha256=/, '');
  for (const secret of secrets) {
    if (!secret) continue;
    const expected = crypto.createHmac('sha256', secret).update(raw).digest(encoding);
    if (safeEqual(expected, provided)) return true;
  }
  return false;
}

async function accountByExternalId(channel: Channel, ids: Array<string | undefined | null>) {
  const clean = ids.filter((id): id is string => Boolean(id));
  if (!clean.length) return null;
  const matches = await prisma.connectedChannelAccount.findMany({
    where: { channel, externalAccountId: { in: clean }, status: 'CONNECTED' },
    take: 2,
  });
  // Refuse ambiguous routing: delivering to the wrong workspace would leak customer messages.
  if (matches.length > 1 && new Set(matches.map((m) => m.organizationId)).size > 1) {
    console.error(`Inbound ${channel} webhook: account ID claimed by several workspaces; message not routed.`);
    return null;
  }
  return matches[0] || null;
}

function suppliedSecret(req: NextRequest) {
  const header = req.headers.get('x-webhook-secret') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  return (header || req.nextUrl.searchParams.get('token') || '').trim();
}

async function accountBySecret(req: NextRequest, channel: Channel) {
  const secret = suppliedSecret(req);
  if (!secret) return null;
  return prisma.connectedChannelAccount.findFirst({
    where: { channel, webhookSecret: secret, status: 'CONNECTED' },
  });
}

function metaSecrets(account: { appSecret: string | null }) {
  return [process.env.META_APP_SECRET, decryptSecret(account.appSecret)];
}

/** GET: subscription handshakes (Meta hub.challenge, X CRC) and a status probe. */
export async function handleWebhookGet(req: NextRequest, channelHint?: string) {
  const search = req.nextUrl.searchParams;
  const mode = search.get('hub.mode');
  const token = search.get('hub.verify_token');
  const challenge = search.get('hub.challenge');

  if (mode === 'subscribe' && challenge) {
    const expected = process.env.META_WEBHOOK_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN;
    let ok = Boolean(token && expected && safeEqual(token, expected));
    if (!ok && token) {
      const match = await prisma.connectedChannelAccount.findFirst({ where: { webhookSecret: token, status: 'CONNECTED' } });
      ok = Boolean(match);
    }
    if (ok) return new NextResponse(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
    return NextResponse.json({ error: 'Webhook verification token mismatch' }, { status: 403 });
  }

  const crcToken = search.get('crc_token');
  if (crcToken) {
    const consumerSecret = process.env.TWITTER_CONSUMER_SECRET || process.env.X_API_SECRET;
    if (!consumerSecret) return NextResponse.json({ error: 'X webhook secret is not configured.' }, { status: 503 });
    const hmac = crypto.createHmac('sha256', consumerSecret).update(crcToken).digest('base64');
    return NextResponse.json({ response_token: `sha256=${hmac}` });
  }

  return NextResponse.json({ status: 'active', channel: channelHint?.toUpperCase() || undefined });
}

type Parsed = {
  organizationId: string;
  channel: Channel;
  content: string;
  externalMessageId?: string;
  senderExternalId?: string;
  senderHandle?: string;
  senderName?: string;
  senderEmail?: string;
  senderPhone?: string;
  metadata?: any;
};

class WebhookAuthError extends Error {}

function parseMeta(payload: any, raw: string, signature: string | null): Promise<Parsed[]> {
  return (async () => {
    const out: Parsed[] = [];
    const object = payload.object as string;
    const channel: Channel = object === 'instagram' ? 'INSTAGRAM' : object === 'whatsapp_business_account' ? 'WHATSAPP' : 'FACEBOOK';

    for (const entry of payload.entry || []) {
      // --- Messenger / Instagram messaging events
      for (const ev of entry.messaging || []) {
        const account = await accountByExternalId(channel, [entry.id, ev.recipient?.id]);
        if (!account) continue; // unknown destination: never guess a tenant
        if (!validHmac(raw, signature, metaSecrets(account), 'hex')) throw new WebhookAuthError('Invalid signature');
        if (ev.message?.is_echo) continue;
        const text = ev.message?.text;
        const senderId = ev.sender?.id;
        if (!text || !senderId) continue;
        out.push({
          organizationId: account.organizationId,
          channel,
          content: text,
          externalMessageId: ev.message?.mid,
          senderExternalId: senderId,
          senderHandle: `@${senderId}`,
          metadata: { mid: ev.message?.mid, recipientId: ev.recipient?.id },
        });
      }

      // --- WhatsApp Cloud API
      for (const change of entry.changes || []) {
        if (change.field !== 'messages') continue;
        const value = change.value || {};
        const account = await accountByExternalId('WHATSAPP', [value.metadata?.phone_number_id]);
        if (!account) continue;
        if (!validHmac(raw, signature, metaSecrets(account), 'hex')) throw new WebhookAuthError('Invalid signature');
        // Delivery ticks for messages we sent.
        for (const s of value.statuses || []) await applyStatus(account.organizationId, s);
        for (const msg of value.messages || []) {
          // Photos, documents, voice notes, videos and stickers: keep the media ID; the file is fetched on demand.
          const file = msg.image || msg.document || msg.audio || msg.video || msg.sticker;
          const media = file?.id ? { id: String(file.id), type: msg.type, mime: file.mime_type || null, filename: file.filename || null } : null;
          const label: Record<string, string> = { image: 'Photo', document: 'Document', audio: 'Voice note', video: 'Video', sticker: 'Sticker' };
          const text = msg.text?.body || msg.button?.text || msg.interactive?.button_reply?.title || file?.caption
            || (media ? `[${label[msg.type] || 'Attachment'}${media.filename ? `: ${media.filename}` : ''}]` : msg.type ? `[${msg.type}]` : '');
          if (!text || !msg.from) continue;
          out.push({
            organizationId: account.organizationId,
            channel: 'WHATSAPP',
            content: text,
            externalMessageId: msg.id,
            senderPhone: msg.from,
            senderName: value.contacts?.[0]?.profile?.name,
            metadata: { wamid: msg.id, type: msg.type, ...(media ? { media } : {}) },
          });
        }
      }
    }
    return out;
  })();
}

async function parseX(payload: any, raw: string, req: NextRequest): Promise<Parsed[]> {
  const account = await accountByExternalId('X', [payload.for_user_id]);
  if (!account) return [];
  const secrets = [process.env.TWITTER_CONSUMER_SECRET, process.env.X_API_SECRET, decryptSecret(account.appSecret)];
  if (!validHmac(raw, req.headers.get('x-twitter-webhooks-signature'), secrets, 'base64')) throw new WebhookAuthError('Invalid signature');
  const out: Parsed[] = [];
  for (const ev of payload.direct_message_events || []) {
    if (ev.type !== 'message_create') continue;
    const text = ev.message_create?.message_data?.text;
    const senderId = ev.message_create?.sender_id;
    if (!text || !senderId || senderId === payload.for_user_id) continue;
    out.push({
      organizationId: account.organizationId,
      channel: 'X',
      content: text,
      externalMessageId: ev.id,
      senderExternalId: senderId,
      senderHandle: `@user_${senderId}`,
    });
  }
  return out;
}

async function parseSecretAuthenticated(payload: any, raw: string, req: NextRequest, channelHint?: Channel): Promise<Parsed[]> {
  // TikTok-shaped payload
  const isTikTok = payload?.event === 'im.message.receive' || payload?.open_id || payload?.data?.from_user_id;
  const channel: Channel | null = isTikTok
    ? 'TIKTOK'
    : GENERIC_CHANNELS.includes(String(payload?.channel || '').toUpperCase() as Channel)
      ? (String(payload.channel).toUpperCase() as Channel)
      : channelHint || null;
  if (!channel) return [];

  const account = await accountBySecret(req, channel);
  if (!account) throw new WebhookAuthError('Invalid or missing webhook secret');

  if (channel === 'EMAIL') {
    const provider = providerRegistry.getProvider('EMAIL');
    const messages = provider ? await provider.parseWebhookPayload(raw, req.headers) : [];
    return messages.map((m) => ({
      organizationId: account.organizationId,
      channel: 'EMAIL' as Channel,
      content: m.content,
      externalMessageId: m.externalMessageId,
      senderEmail: m.senderEmail,
      senderName: m.senderName,
      metadata: m.metadata,
    }));
  }

  if (channel === 'TIKTOK' && isTikTok) {
    const senderOpenId = payload.data?.from_user_id || payload.data?.open_id || payload.open_id || payload.sender_id || payload.from_user_id;
    const text = payload.data?.content || payload.content || payload.message?.text || payload.data?.text;
    if (!senderOpenId || !text) return [];
    return [{
      organizationId: account.organizationId,
      channel: 'TIKTOK',
      content: typeof text === 'object' ? JSON.stringify(text) : String(text),
      senderExternalId: String(senderOpenId),
      senderHandle: `@${String(senderOpenId).slice(0, 15)}`,
    }];
  }

  if (!payload?.content) return [];
  return [{
    organizationId: account.organizationId, // from the authenticated account, NOT from the body
    channel,
    content: String(payload.content).slice(0, 10000),
    externalMessageId: payload.externalMessageId || payload.messageId,
    senderExternalId: payload.senderExternalId || payload.senderId,
    senderHandle: payload.senderHandle || payload.handle,
    senderName: payload.senderName || payload.contactName,
    senderEmail: payload.senderEmail || payload.email,
    senderPhone: payload.senderPhone || payload.phone,
    metadata: payload.metadata,
  }];
}

/** POST: inbound messages. */
export async function handleWebhookPost(req: NextRequest, channelHint?: string) {
  try {
    const raw = await req.text();
    let payload: any;
    try {
      payload = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const hint = channelHint && GENERIC_CHANNELS.includes(channelHint.toUpperCase() as Channel) ? (channelHint.toUpperCase() as Channel) : undefined;
    let parsed: Parsed[] = [];

    if (['instagram', 'page', 'whatsapp_business_account'].includes(payload?.object)) {
      parsed = await parseMeta(payload, raw, req.headers.get('x-hub-signature-256'));
    } else if (Array.isArray(payload?.direct_message_events)) {
      parsed = await parseX(payload, raw, req);
    } else {
      parsed = await parseSecretAuthenticated(payload, raw, req, hint);
    }

    const events: Array<{ conversationId?: string; messageId?: string; duplicate: boolean }> = [];
    for (const m of parsed) {
      const res: any = await recordInboundChannelMessage({
        organizationId: m.organizationId,
        channel: m.channel,
        content: m.content,
        externalMessageId: m.externalMessageId,
        senderExternalId: m.senderExternalId,
        senderHandle: m.senderHandle,
        senderName: m.senderName,
        senderEmail: m.senderEmail,
        senderPhone: m.senderPhone,
        metadata: m.metadata,
      });
      events.push({ conversationId: res.conversation?.id, messageId: res.message?.id, duplicate: Boolean(res.isDuplicate) });
    }
    return NextResponse.json({ success: true, processed: events.length, events });
  } catch (error: any) {
    if (error instanceof WebhookAuthError) {
      return NextResponse.json({ error: 'Webhook authentication failed' }, { status: 401 });
    }
    console.error('Inbound webhook processing error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
