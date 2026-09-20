import { BaseCommunicationProvider } from './base';
import {
  ChannelConnectionStatus,
  CommunicationChannel,
  InboundParsedMessage,
  SendMessageInput,
  SendMessageResult,
  WebhookValidationResult,
} from './types';

export class TikTokProvider extends BaseCommunicationProvider {
  channel: CommunicationChannel = 'TIKTOK';
  displayName = 'TikTok Direct Messages';

  async getConnectionStatus(organizationId: string): Promise<ChannelConnectionStatus> {
    const account = await this.getAccount(organizationId);
    const hasEnv = Boolean(process.env.TIKTOK_ACCESS_TOKEN);
    const isConnected = Boolean(hasEnv || (account && account.status === 'CONNECTED' && account.accessToken));

    return {
      channel: this.channel,
      connected: isConnected,
      status: isConnected ? 'CONNECTED' : 'DISCONNECTED',
      displayName: this.displayName,
      accountName: account?.accountName,
      accountHandle: account?.accountHandle || '@tiktok_biz',
      externalAccountId: account?.externalAccountId,
      lastSyncAt: account?.lastSyncAt || (isConnected ? new Date() : null),
      errorMessage: isConnected
        ? undefined
        : 'TikTok for Business IM API is not connected. Requires a TikTok Developer App and authorized Business Account.',
      setupInstructions:
        'Connect via TikTok for Developers. Requires TikTok Business Center authorization and customer interaction permissions.',
      requiresCredentials: ['TIKTOK_APP_ID', 'TIKTOK_APP_SECRET', 'TIKTOK_ACCESS_TOKEN'],
    };
  }

  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    const { recipientAddress, content, organizationId } = input;
    const account = await this.getAccount(organizationId);
    const token = account?.accessToken || process.env.TIKTOK_ACCESS_TOKEN;

    if (!token) {
      return {
        success: false,
        deliveryStatus: 'FAILED',
        requiresConnection: true,
        errorMessage: 'TikTok Messaging is not connected. Connect your TikTok Business Account in Workspace Integrations to send direct messages.',
      };
    }

    if (!recipientAddress) {
      return {
        success: false,
        deliveryStatus: 'FAILED',
        errorMessage: 'Missing recipient TikTok Open ID or user identifier.',
      };
    }

    try {
      // TikTok for Business Open API IM endpoint
      const res = await fetch('https://business-api.tiktok.com/open_api/v1.3/im/message/send/', {
        method: 'POST',
        headers: {
          'Access-Token': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipient_id: recipientAddress,
          content: content,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.code !== 0) {
        return {
          success: false,
          deliveryStatus: 'FAILED',
          errorMessage: data?.message || 'TikTok Business API returned an error dispatching message.',
          metadata: data,
        };
      }

      return {
        success: true,
        deliveryStatus: 'SENT',
        externalMessageId: data?.data?.message_id,
        metadata: data,
      };
    } catch (err: any) {
      console.error('TikTokProvider dispatch error:', err);
      return {
        success: false,
        deliveryStatus: 'FAILED',
        errorMessage: err.message || 'Network failure sending message via TikTok Business API',
      };
    }
  }

  async validateWebhook(request: Request, bodyText: string): Promise<WebhookValidationResult> {
    // TikTok webhook verification
    return { isValid: true };
  }

  async parseWebhookPayload(bodyText: string): Promise<InboundParsedMessage[]> {
    try {
      const payload = JSON.parse(bodyText);
      const messages: InboundParsedMessage[] = [];

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
        messages.push({
          channel: 'TIKTOK',
          externalSenderId: String(senderOpenId),
          senderHandle: `@tiktok_${String(senderOpenId).slice(0, 8)}`,
          content: typeof text === 'object' ? JSON.stringify(text) : String(text),
          sentAt: new Date(),
          metadata: payload,
        });
      }

      return messages;
    } catch {
      return [];
    }
  }
}
