import { BaseCommunicationProvider } from './base';
import {
  ChannelConnectionStatus,
  CommunicationChannel,
  InboundParsedMessage,
  SendMessageInput,
  SendMessageResult,
  WebhookValidationResult,
} from './types';

export class InstagramProvider extends BaseCommunicationProvider {
  channel: CommunicationChannel = 'INSTAGRAM';
  displayName = 'Instagram Direct';

  async getConnectionStatus(organizationId: string): Promise<ChannelConnectionStatus> {
    const account = await this.getAccount(organizationId);
    const hasEnv = Boolean(process.env.INSTAGRAM_ACCESS_TOKEN);
    const isConnected = Boolean(hasEnv || (account && account.status === 'CONNECTED' && account.accessToken));

    return {
      channel: this.channel,
      connected: isConnected,
      status: isConnected ? 'CONNECTED' : 'DISCONNECTED',
      displayName: this.displayName,
      accountName: account?.accountName,
      accountHandle: account?.accountHandle || '@instagram',
      externalAccountId: account?.externalAccountId,
      lastSyncAt: account?.lastSyncAt || (isConnected ? new Date() : null),
      errorMessage: isConnected
        ? undefined
        : 'Instagram Messaging is not connected. Connect an Instagram Professional Account linked to a Facebook Page.',
      setupInstructions:
        'Connect via Meta for Developers. Requires an Instagram Professional Account (Business or Creator) linked to a Meta Page with "instagram_manage_messages" permission.',
      requiresCredentials: ['INSTAGRAM_PAGE_ACCESS_TOKEN', 'INSTAGRAM_ACCOUNT_ID', 'META_APP_SECRET'],
    };
  }

  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    const { recipientAddress, content, organizationId } = input;
    const account = await this.getAccount(organizationId);
    const token = account?.accessToken || process.env.INSTAGRAM_ACCESS_TOKEN;

    if (!token) {
      return {
        success: false,
        deliveryStatus: 'FAILED',
        requiresConnection: true,
        errorMessage: 'Instagram Direct is not connected. Connect your Instagram Business Account in Integrations to send messages.',
      };
    }

    if (!recipientAddress) {
      return {
        success: false,
        deliveryStatus: 'FAILED',
        errorMessage: 'Missing recipient Instagram IGSID or recipient identifier.',
      };
    }

    try {
      const version = process.env.META_GRAPH_API_VERSION || 'v21.0';
      const url = `https://graph.facebook.com/${version}/me/messages`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipient: { id: recipientAddress },
          message: { text: content },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          deliveryStatus: 'FAILED',
          errorMessage: data?.error?.message || 'Meta Graph API returned an error dispatching Instagram DM.',
          metadata: data,
        };
      }

      return {
        success: true,
        deliveryStatus: 'SENT',
        externalMessageId: data?.message_id,
        metadata: data,
      };
    } catch (err: any) {
      console.error('InstagramProvider dispatch error:', err);
      return {
        success: false,
        deliveryStatus: 'FAILED',
        errorMessage: err.message || 'Network failure sending Instagram Direct message',
      };
    }
  }

  async validateWebhook(request: Request, bodyText: string): Promise<WebhookValidationResult> {
    const url = new URL(request.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode === 'subscribe' && challenge) {
      const expectedToken = process.env.INSTAGRAM_VERIFY_TOKEN || process.env.META_WEBHOOK_VERIFY_TOKEN;
      if (expectedToken && token === expectedToken) {
        return { isValid: true, challengeResponse: challenge };
      }
      return { isValid: false, error: 'Meta Instagram webhook verification token mismatch' };
    }

    return { isValid: true };
  }

  async parseWebhookPayload(bodyText: string): Promise<InboundParsedMessage[]> {
    try {
      const data = JSON.parse(bodyText);
      const messages: InboundParsedMessage[] = [];

      if (data.object === 'instagram') {
        for (const entry of data.entry || []) {
          for (const messaging of entry.messaging || []) {
            if (messaging.message?.is_echo) continue;
            const text = messaging.message?.text;
            const senderId = messaging.sender?.id;

            if (text && senderId) {
              messages.push({
                channel: 'INSTAGRAM',
                externalMessageId: messaging.message?.mid,
                externalSenderId: senderId,
                senderHandle: `@${senderId}`,
                content: text,
                sentAt: messaging.timestamp ? new Date(Number(messaging.timestamp)) : new Date(),
                metadata: {
                  mid: messaging.message?.mid,
                  recipientId: messaging.recipient?.id,
                },
              });
            }
          }
        }
      }

      return messages;
    } catch {
      return [];
    }
  }
}
