import { NextRequest, NextResponse } from 'next/server';
import { providerRegistry, CommunicationChannel } from '@/lib/communication-providers';
import { recordInboundChannelMessage } from '@/lib/inbox';

export const runtime = 'nodejs';

/**
 * GET Handler: Webhook Verification and Handshake
 * - Meta (WhatsApp, Instagram, Facebook): hub.mode, hub.challenge, hub.verify_token
 * - X (Twitter): crc_token
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { channel: string } }
) {
  const channelName = params.channel.toUpperCase() as CommunicationChannel;
  const provider = providerRegistry.getProvider(channelName);

  if (!provider) {
    return NextResponse.json({ error: `Unsupported channel: ${params.channel}` }, { status: 404 });
  }

  const validation = await provider.validateWebhook(req, '');
  if (validation.isValid && validation.challengeResponse) {
    return new NextResponse(validation.challengeResponse, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  if (!validation.isValid) {
    return NextResponse.json({ error: validation.error || 'Webhook verification failed' }, { status: 403 });
  }

  return NextResponse.json({
    status: 'active',
    channel: channelName,
    endpoint: `/api/webhooks/communications/${params.channel.toLowerCase()}`,
  });
}

/**
 * POST Handler: Inbound Webhook Payload Processing
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { channel: string } }
) {
  const channelName = params.channel.toUpperCase() as CommunicationChannel;
  const provider = providerRegistry.getProvider(channelName);

  if (!provider) {
    return NextResponse.json({ error: `Unsupported channel: ${params.channel}` }, { status: 404 });
  }

  try {
    const rawText = await req.text();

    // 1. Authenticate / Validate webhook
    const validation = await provider.validateWebhook(req, rawText);
    if (!validation.isValid) {
      return NextResponse.json({ error: validation.error || 'Invalid webhook signature' }, { status: 401 });
    }

    // 2. Parse provider payload
    const parsedMessages = await provider.parseWebhookPayload(rawText, req.headers);

    if (!parsedMessages || parsedMessages.length === 0) {
      return NextResponse.json({ success: true, processed: 0, message: 'No actionable messages in payload' });
    }

    // 3. Process each message into Unified Inbox
    const results: any[] = [];
    for (const msg of parsedMessages) {
      const res = await recordInboundChannelMessage({
        channel: msg.channel,
        content: msg.content,
        externalMessageId: msg.externalMessageId,
        senderExternalId: msg.externalSenderId,
        senderHandle: msg.senderHandle,
        senderName: msg.senderName,
        senderEmail: msg.senderEmail,
        senderPhone: msg.senderPhone,
        metadata: msg.metadata,
      });
      results.push(res);
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      events: results.map((r) => ({
        conversationId: r.conversation?.id,
        messageId: r.message?.id,
        isDuplicate: Boolean(r.isDuplicate),
      })),
    });
  } catch (error: any) {
    console.error(`Error in webhook /api/webhooks/communications/${params.channel}:`, error);
    return NextResponse.json({ error: error.message || 'Webhook processing failed' }, { status: 500 });
  }
}
