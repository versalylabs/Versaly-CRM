import { BaseCommunicationProvider } from './base';
import {
  ChannelConnectionStatus,
  CommunicationChannel,
  InboundParsedMessage,
  SendMessageInput,
  SendMessageResult,
  WebhookValidationResult,
} from './types';

export class WhatsAppProvider extends BaseCommunicationProvider {
  channel: CommunicationChannel = 'WHATSAPP';
  displayName = 'WhatsApp Business Cloud API';

  private isConfigured(): boolean {
    return Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN);
  }

  async getConnectionStatus(organizationId: string): Promise<ChannelConnectionStatus> {
    const account = await this.getAccount(organizationId);
    const hasEnv = this.isConfigured();
    const isConnected = Boolean(hasEnv || (account && account.status === 'CONNECTED' && account.accessToken));

    return {
      channel: this.channel,
      connected: isConnected,
      status: isConnected ? 'CONNECTED' : 'DISCONNECTED',
      displayName: this.displayName,
      accountName: account?.accountName || (hasEnv ? 'WhatsApp Cloud Gateway' : undefined),
      accountHandle: account?.accountHandle || process.env.WHATSAPP_PHONE_NUMBER || undefined,
      externalAccountId: account?.externalAccountId || process.env.WHATSAPP_PHONE_NUMBER_ID,
      lastSyncAt: account?.lastSyncAt || (isConnected ? new Date() : null),
      errorMessage: isConnected
        ? undefined
        : 'WhatsApp Cloud API credentials (WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN) are not connected.',
      setupInstructions:
        'Connect your Meta Developer WhatsApp Business Account. Add your Phone Number ID and System User Access Token.',
      requiresCredentials: ['WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_VERIFY_TOKEN'],
    };
  }

  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    const { recipientAddress, content, organizationId } = input;
    const account = await this.getAccount(organizationId);

    const token = account?.accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneId = account?.externalAccountId || process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!token || !phoneId) {
      return {
        success: false,
        deliveryStatus: 'FAILED',
        requiresConnection: true,
        errorMessage: 'WhatsApp is not connected. Configure WhatsApp credentials in Workspace Integrations to send live messages.',
      };
    }

    if (!recipientAddress) {
      return {
        success: false,
        deliveryStatus: 'FAILED',
        errorMessage: 'Missing recipient phone number for WhatsApp message.',
      };
    }

    const cleanPhone = recipientAddress.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 8) {
      return {
        success: false,
        deliveryStatus: 'FAILED',
        errorMessage: 'Invalid recipient phone number format. Must include country code and at least 8 digits.',
      };
    }

    try {
      const version = process.env.WHATSAPP_GRAPH_API_VERSION || 'v21.0';
      const url = `https://graph.facebook.com/${version}/${phoneId}/messages`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanPhone,
          type: 'text',
          text: { preview_url: true, body: content },
        }),
      });

      const responseData = await res.json();
      if (!res.ok) {
        return {
          success: false,
          deliveryStatus: 'FAILED',
          errorMessage: responseData?.error?.message || 'Meta WhatsApp API returned an error dispatching message.',
          metadata: responseData,
        };
      }

      const externalMessageId = responseData?.messages?.[0]?.id;
      return {
        success: true,
        deliveryStatus: 'SENT',
        externalMessageId,
        metadata: responseData,
      };
    } catch (err: any) {
      console.error('WhatsAppProvider dispatch error:', err);
      return {
        success: false,
        deliveryStatus: 'FAILED',
        errorMessage: err.message || 'Network failure dispatching to WhatsApp Cloud API',
      };
    }
  }

  async validateWebhook(request: Request, bodyText: string): Promise<WebhookValidationResult> {
    const url = new URL(request.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode === 'subscribe' && challenge) {
      const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN || process.env.META_WEBHOOK_VERIFY_TOKEN;
      if (expectedToken && token === expectedToken) {
        return { isValid: true, challengeResponse: challenge };
      }
      return { isValid: false, error: 'Meta webhook verify token mismatch' };
    }

    return { isValid: true };
  }

  async parseWebhookPayload(bodyText: string): Promise<InboundParsedMessage[]> {
    try {
      const data = JSON.parse(bodyText);
      const messages: InboundParsedMessage[] = [];

      if (data.object === 'whatsapp_business_account') {
        for (const entry of data.entry || []) {
          for (const change of entry.changes || []) {
            if (change.field === 'messages') {
              const value = change.value || {};
              const contactName = value.contacts?.[0]?.profile?.name;
              for (const waMsg of value.messages || []) {
                const text = waMsg.text?.body || waMsg.button?.text || (waMsg.type === 'image' ? '[Image Attachment]' : '');
                if (text && waMsg.from) {
                  messages.push({
                    channel: 'WHATSAPP',
                    externalMessageId: waMsg.id,
                    externalSenderId: waMsg.from,
                    senderPhone: waMsg.from,
                    senderName: contactName || waMsg.from,
                    content: text,
                    sentAt: waMsg.timestamp ? new Date(Number(waMsg.timestamp) * 1000) : new Date(),
                    metadata: {
                      rawMsgType: waMsg.type,
                      wamid: waMsg.id,
                    },
                  });
                }
              }
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
