import crypto from 'crypto';
import { BaseCommunicationProvider } from './base';
import {
  ChannelConnectionStatus,
  CommunicationChannel,
  InboundParsedMessage,
  SendMessageInput,
  SendMessageResult,
  WebhookValidationResult,
} from './types';

export class XProvider extends BaseCommunicationProvider {
  channel: CommunicationChannel = 'X';
  displayName = 'X (formerly Twitter)';

  async getConnectionStatus(organizationId: string): Promise<ChannelConnectionStatus> {
    const account = await this.getAccount(organizationId);
    const hasEnv = Boolean(process.env.TWITTER_BEARER_TOKEN || process.env.X_BEARER_TOKEN);
    const isConnected = Boolean(hasEnv || (account && account.status === 'CONNECTED' && account.accessToken));

    return {
      channel: this.channel,
      connected: isConnected,
      status: isConnected ? 'CONNECTED' : 'DISCONNECTED',
      displayName: this.displayName,
      accountName: account?.accountName || (hasEnv ? 'X Direct Message Gateway' : undefined),
      accountHandle: account?.accountHandle || '@versalylabs',
      externalAccountId: account?.externalAccountId,
      lastSyncAt: account?.lastSyncAt || (isConnected ? new Date() : null),
      errorMessage: isConnected
        ? undefined
        : 'X (Twitter) Direct Messages API is not connected. Requires OAuth 2.0 User Context or Bearer Token.',
      setupInstructions:
        'Connect via Twitter Developer Portal. Requires an App with Read, Write, and Direct Messages permissions and OAuth 2.0.',
      requiresCredentials: ['X_API_KEY', 'X_API_SECRET', 'X_BEARER_TOKEN', 'X_ACCESS_TOKEN'],
    };
  }

  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    const { recipientAddress, content, organizationId } = input;
    const account = await this.getAccount(organizationId);
    const token = account?.accessToken || process.env.TWITTER_BEARER_TOKEN || process.env.X_BEARER_TOKEN;

    if (!token) {
      return {
        success: false,
        deliveryStatus: 'FAILED',
        requiresConnection: true,
        errorMessage: 'X (Twitter) is not connected. Connect X in Workspace Integrations to send direct messages.',
      };
    }

    if (!recipientAddress) {
      return {
        success: false,
        deliveryStatus: 'FAILED',
        errorMessage: 'Missing recipient X User ID or handle.',
      };
    }

    try {
      // X API v2 Direct Messages endpoint
      const res = await fetch('https://api.twitter.com/2/dm_conversations/messages', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: { text: content },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          deliveryStatus: 'FAILED',
          errorMessage: data?.detail || data?.title || 'X API returned an error dispatching DM.',
          metadata: data,
        };
      }

      return {
        success: true,
        deliveryStatus: 'SENT',
        externalMessageId: data?.data?.dm_event_id || data?.data?.id,
        metadata: data,
      };
    } catch (err: any) {
      console.error('XProvider dispatch error:', err);
      return {
        success: false,
        deliveryStatus: 'FAILED',
        errorMessage: err.message || 'Network failure sending message via X API',
      };
    }
  }

  async validateWebhook(request: Request, bodyText: string): Promise<WebhookValidationResult> {
    const url = new URL(request.url);
    const crcToken = url.searchParams.get('crc_token');

    if (crcToken) {
      const consumerSecret = process.env.TWITTER_CONSUMER_SECRET || process.env.X_API_SECRET || 'secret';
      const hmac = crypto.createHmac('sha256', consumerSecret).update(crcToken).digest('base64');
      return { isValid: true, challengeResponse: JSON.stringify({ response_token: `sha256=${hmac}` }) };
    }

    return { isValid: true };
  }

  async parseWebhookPayload(bodyText: string): Promise<InboundParsedMessage[]> {
    try {
      const data = JSON.parse(bodyText);
      const messages: InboundParsedMessage[] = [];

      if (data.direct_message_events) {
        for (const dmEvent of data.direct_message_events) {
          if (dmEvent.type === 'message_create') {
            const text = dmEvent.message_create?.message_data?.text;
            const senderId = dmEvent.message_create?.sender_id;

            if (text && senderId) {
              messages.push({
                channel: 'X',
                externalMessageId: dmEvent.id,
                externalSenderId: senderId,
                senderHandle: `@x_user_${senderId}`,
                content: text,
                sentAt: dmEvent.created_timestamp ? new Date(Number(dmEvent.created_timestamp)) : new Date(),
                metadata: {
                  dmEventId: dmEvent.id,
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
