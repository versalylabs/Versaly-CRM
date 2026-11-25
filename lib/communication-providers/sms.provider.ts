import prisma from '@/lib/prisma';
import { sendSms, smsConfigured } from '@/lib/sms';
import { BaseCommunicationProvider } from './base';
import { ChannelConnectionStatus, CommunicationChannel, InboundParsedMessage, SendMessageInput, SendMessageResult, WebhookValidationResult } from './types';

/** Outbound SMS from prepaid credits. One-way: replies are not received (sender IDs cannot receive messages). */
export class SmsProvider extends BaseCommunicationProvider {
  channel: CommunicationChannel = 'SMS';
  displayName = 'SMS';

  async getConnectionStatus(organizationId: string): Promise<ChannelConnectionStatus> {
    const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { smsCredits: true } });
    const credits = org?.smsCredits || 0;
    const connected = smsConfigured() && credits > 0;
    return {
      channel: this.channel,
      connected,
      status: connected ? 'CONNECTED' : 'DISCONNECTED',
      displayName: this.displayName,
      accountName: `${credits.toLocaleString('en-US')} SMS credits`,
      errorMessage: connected ? undefined : smsConfigured() ? 'Buy SMS credits in Settings → Messaging.' : 'SMS is not available yet.',
      setupInstructions: 'Buy SMS credits in Settings → Messaging.',
      requiresCredentials: [],
    };
  }

  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    const r = await sendSms({ organizationId: input.organizationId, to: input.recipientAddress || '', message: input.content, userId: input.senderId });
    return r.ok
      ? { success: true, deliveryStatus: 'SENT', externalMessageId: r.messageId, metadata: { credits: r.credits } }
      : { success: false, deliveryStatus: 'FAILED', errorMessage: r.error, requiresConnection: /credits|not available/i.test(r.error || '') };
  }

  async validateWebhook(): Promise<WebhookValidationResult> {
    return { isValid: false, error: 'SMS has no inbound webhook.' };
  }

  async parseWebhookPayload(): Promise<InboundParsedMessage[]> {
    return [];
  }
}
