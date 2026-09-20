import {
  CommunicationChannel,
  CommunicationProvider,
  ChannelConnectionStatus,
  SendMessageInput,
  SendMessageResult,
  WebhookValidationResult,
  InboundParsedMessage,
} from './types';
import prisma from '@/lib/prisma';

export abstract class BaseCommunicationProvider implements CommunicationProvider {
  abstract channel: CommunicationChannel;
  abstract displayName: string;

  abstract getConnectionStatus(organizationId: string): Promise<ChannelConnectionStatus>;
  abstract sendMessage(input: SendMessageInput): Promise<SendMessageResult>;
  abstract validateWebhook(request: Request, bodyText: string): Promise<WebhookValidationResult>;
  abstract parseWebhookPayload(bodyText: string, headers?: Headers): Promise<InboundParsedMessage[]>;

  /**
   * Helper to retrieve connected channel account credentials securely for an organization.
   */
  protected async getAccount(organizationId: string) {
    return prisma.connectedChannelAccount.findFirst({
      where: {
        organizationId,
        channel: this.channel,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }
}
