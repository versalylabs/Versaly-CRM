import { BaseCommunicationProvider } from './base';
import {
  ChannelConnectionStatus,
  CommunicationChannel,
  InboundParsedMessage,
  SendMessageInput,
  SendMessageResult,
  WebhookValidationResult,
} from './types';

export class FacebookProvider extends BaseCommunicationProvider {
  channel: CommunicationChannel = 'FACEBOOK';
  displayName = 'Facebook Messenger';

  async getConnectionStatus(organizationId: string): Promise<ChannelConnectionStatus> {
    const account = await this.getAccount(organizationId);
    const hasEnv = Boolean(process.env.FACEBOOK_PAGE_ACCESS_TOKEN);
    const isConnected = Boolean(hasEnv || (account && account.status === 'CONNECTED' && account.accessToken));

    return {
      channel: this.channel,
      connected: isConnected,
      status: isConnected ? 'CONNECTED' : 'DISCONNECTED',
      displayName: this.displayName,
      accountName: account?.accountName || (hasEnv ? 'Facebook Business Page' : undefined),
      accountHandle: account?.accountHandle || 'fb.page',
      externalAccountId: account?.externalAccountId || process.env.FACEBOOK_PAGE_ID,
      lastSyncAt: account?.lastSyncAt || (isConnected ? new Date() : null),
      errorMessage: isConnected
        ? undefined
        : 'Facebook Messenger is not connected. Requires a Meta Facebook Page Access Token.',
      setupInstructions:
        'Connect your Facebook Business Page via Meta App Dashboard with "pages_messaging" permission.',
      requiresCredentials: ['FACEBOOK_PAGE_ACCESS_TOKEN', 'FACEBOOK_PAGE_ID', 'META_APP_SECRET'],
    };
  }

  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    const { recipientAddress, content, organizationId } = input;
    const account = await this.getAccount(organizationId);
    const token = account?.accessToken || process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

    if (!token) {
      return {
        success: false,
        deliveryStatus: 'FAILED',
        requiresConnection: true,
        errorMessage: 'Facebook Messenger is not connected. Connect your Facebook Page in Settings -> Integrations to send messages.',
      };
    }

    if (!recipientAddress) {
      return {
        success: false,
        deliveryStatus: 'FAILED',
        errorMessage: 'Missing recipient Facebook PSID (Page-Scoped ID).',
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
          errorMessage: data?.error?.message || 'Meta Graph API error dispatching Facebook message.',
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
      console.error('FacebookProvider dispatch error:', err);
      return {
        success: false,
        deliveryStatus: 'FAILED',
        errorMessage: err.message || 'Network failure sending Facebook message',
      };
    }
  }

  async validateWebhook(request: Request, bodyText: string): Promise<WebhookValidationResult> {
    const url = new URL(request.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode === 'subscribe' && challenge) {
      const expectedToken = process.env.FACEBOOK_VERIFY_TOKEN || process.env.META_WEBHOOK_VERIFY_TOKEN;
      if (expectedToken && token === expectedToken) {
        return { isValid: true, challengeResponse: challenge };
      }
      return { isValid: false, error: 'Facebook webhook verification token mismatch' };
    }

    return { isValid: true };
  }

  async parseWebhookPayload(bodyText: string): Promise<InboundParsedMessage[]> {
    try {
      const data = JSON.parse(bodyText);
      const messages: InboundParsedMessage[] = [];

      if (data.object === 'page') {
        for (const entry of data.entry || []) {
          for (const messaging of entry.messaging || []) {
            if (messaging.message?.is_echo) continue;
            const text = messaging.message?.text;
            const senderId = messaging.sender?.id;

            if (text && senderId) {
              messages.push({
                channel: 'FACEBOOK',
                externalMessageId: messaging.message?.mid,
                externalSenderId: senderId,
                senderHandle: `@fb_${senderId.slice(-6)}`,
                content: text,
                sentAt: messaging.timestamp ? new Date(Number(messaging.timestamp)) : new Date(),
                metadata: {
                  mid: messaging.message?.mid,
                  pageId: entry.id,
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
