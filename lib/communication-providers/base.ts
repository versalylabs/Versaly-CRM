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
import { decryptSecret } from '@/lib/secretBox';

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
    const account = await prisma.connectedChannelAccount.findFirst({
      where: {
        organizationId,
        channel: this.channel,
      },
      orderBy: { updatedAt: 'desc' },
    });
    if (!account) return account;
    // Credentials are encrypted at rest; decrypt only in memory for provider calls.
    return {
      ...account,
      accessToken: decryptSecret(account.accessToken),
      refreshToken: decryptSecret(account.refreshToken),
      appSecret: decryptSecret(account.appSecret),
    };
  }

  /**
   * Platform-level credentials from environment variables belong to the Versaly
   * workspace only. Other workspaces must connect their own account, otherwise
   * they would send messages through the Versaly account identity.
   */
  protected async envFor(organizationId: string, value?: string | null): Promise<string | undefined> {
    if (!value) return undefined;
    const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { slug: true } });
    return org?.slug === (process.env.PLATFORM_ORG_SLUG || 'versaly-hq') ? value : undefined;
  }
}
