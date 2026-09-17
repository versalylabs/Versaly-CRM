import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { recordInboundChannelMessage } from '@/lib/inbox';

export const runtime = 'nodejs';

/**
 * GET Handler for Webhook Verification:
 * - Meta (Instagram & Facebook & WhatsApp) subscription handshake: hub.mode, hub.verify_token, hub.challenge
 * - X (Twitter) CRC verification: crc_token
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;

  // 1. Meta Webhook Handshake
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && challenge) {
    const expectedToken = process.env.META_WEBHOOK_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN;

    // Check if token matches environment variable or any connected channel account's webhookSecret
    let isValid = token && expectedToken && token === expectedToken;

    if (!isValid && token) {
      const matchAccount = await prisma.connectedChannelAccount.findFirst({
        where: { webhookSecret: token, status: 'CONNECTED' },
      });
      if (matchAccount) isValid = true;
    }

    if (isValid || !expectedToken) {
      return new NextResponse(challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    return NextResponse.json({ error: 'Webhook verification token mismatch' }, { status: 403 });
  }

  // 2. X (Twitter) CRC Challenge
  const crcToken = searchParams.get('crc_token');
  if (crcToken) {
    const consumerSecret = process.env.TWITTER_CONSUMER_SECRET || process.env.X_API_SECRET || 'secret';
    const hmac = crypto.createHmac('sha256', consumerSecret).update(crcToken).digest('base64');
    return NextResponse.json({ response_token: `sha256=${hmac}` }, { status: 200 });
  }

  return NextResponse.json({
    status: 'active',
    endpoint: '/api/inbox/webhook',
    supported: ['INSTAGRAM', 'FACEBOOK', 'WHATSAPP', 'TIKTOK', 'X', 'CUSTOM_JSON'],
  });
}

/**
 * POST Handler for Inbound Webhooks across all channels.
 */
export async function POST(req: NextRequest) {
  try {
    const rawText = await req.text();
    let payload: any = {};
    try {
      payload = JSON.parse(rawText);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const processedEvents: any[] = [];

    // Case 1: Meta Instagram, Facebook Messenger & WhatsApp Cloud API Webhook
    if (payload.object === 'instagram' || payload.object === 'page' || payload.object === 'whatsapp_business_account') {
      const isInstagram = payload.object === 'instagram';
      const defaultChannel = isInstagram ? 'INSTAGRAM' : payload.object === 'whatsapp_business_account' ? 'WHATSAPP' : 'FACEBOOK';

      for (const entry of payload.entry || []) {
        // Direct Messaging format
        for (const messagingEvent of entry.messaging || []) {
          const senderId = messagingEvent.sender?.id;
          const recipientId = messagingEvent.recipient?.id;
          const text = messagingEvent.message?.text;

          // Skip echo/outbound messages sent by the page/account itself
          if (messagingEvent.message?.is_echo) continue;
          if (!text || !senderId) continue;

          const res = await recordInboundChannelMessage({
            channel: defaultChannel,
            content: text,
            senderExternalId: senderId,
            senderHandle: `@${senderId}`,
            metadata: {
              mid: messagingEvent.message?.mid,
              recipientId,
              rawEntryId: entry.id,
            },
          });
          processedEvents.push(res);
        }

        // WhatsApp Cloud Webhook inside Meta entry changes
        for (const change of entry.changes || []) {
          if (change.field === 'messages') {
            const value = change.value || {};
            for (const waMsg of value.messages || []) {
              const fromPhone = waMsg.from;
              const text = waMsg.text?.body || waMsg.type;
              const contactName = value.contacts?.[0]?.profile?.name;

              if (text && fromPhone) {
                const res = await recordInboundChannelMessage({
                  channel: 'WHATSAPP',
                  content: text,
                  senderPhone: fromPhone,
                  senderName: contactName,
                  metadata: { wamid: waMsg.id },
                });
                processedEvents.push(res);
              }
            }
          }
        }
      }
    }

    // Case 2: TikTok Direct Messaging Webhook
    else if (payload.event === 'im.message.receive' || payload.open_id || payload.data?.from_user_id) {
      const senderOpenId =
        payload.data?.from_user_id ||
        payload.data?.open_id ||
        payload.open_id ||
        payload.sender_id ||
        payload.from_user_id;
      const text =
        payload.data?.content ||
        payload.content ||
        payload.message?.text ||
        payload.data?.text;

      if (senderOpenId && text) {
        const res = await recordInboundChannelMessage({
          channel: 'TIKTOK',
          content: typeof text === 'object' ? JSON.stringify(text) : String(text),
          senderExternalId: String(senderOpenId),
          senderHandle: `@${String(senderOpenId).slice(0, 15)}`,
        });
        processedEvents.push(res);
      }
    }

    // Case 3: X (Twitter) Account Activity Direct Message
    else if (payload.direct_message_events) {
      for (const dmEvent of payload.direct_message_events) {
        if (dmEvent.type === 'message_create') {
          const text = dmEvent.message_create?.message_data?.text;
          const senderId = dmEvent.message_create?.sender_id;

          if (text && senderId) {
            const res = await recordInboundChannelMessage({
              channel: 'X',
              content: text,
              senderExternalId: senderId,
              senderHandle: `@user_${senderId}`,
            });
            processedEvents.push(res);
          }
        }
      }
    }

    // Case 4: Generic / Custom Webhook Payload (for Zapier, Make, n8n, custom forms)
    else if (payload.channel && payload.content) {
      const allowedChannels = ['INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'X', 'WHATSAPP', 'EMAIL'];
      const channel = String(payload.channel).toUpperCase();

      if (allowedChannels.includes(channel)) {
        const res = await recordInboundChannelMessage({
          channel: channel as any,
          content: String(payload.content),
          senderExternalId: payload.senderExternalId || payload.senderId,
          senderHandle: payload.senderHandle || payload.handle,
          senderName: payload.senderName || payload.contactName,
          senderEmail: payload.senderEmail || payload.email,
          senderPhone: payload.senderPhone || payload.phone,
          organizationId: payload.organizationId,
          metadata: payload.metadata,
        });
        processedEvents.push(res);
      }
    }

    return NextResponse.json({
      success: true,
      processed: processedEvents.length,
      events: processedEvents.map((e) => ({
        conversationId: e.conversation?.id,
        messageId: e.message?.id,
      })),
    }, { status: 200 });
  } catch (error: any) {
    console.error('Inbound webhook processing error:', error);
    return NextResponse.json({ error: error.message || 'Webhook processing failed' }, { status: 500 });
  }
}
