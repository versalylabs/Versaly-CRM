import nodemailer from 'nodemailer';
import { BaseCommunicationProvider } from './base';
import {
  ChannelConnectionStatus,
  CommunicationChannel,
  InboundParsedMessage,
  SendMessageInput,
  SendMessageResult,
  WebhookValidationResult,
} from './types';
import { getWorkspaceMailbox, smtpTransport } from '@/lib/emailAccount';

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export class EmailProvider extends BaseCommunicationProvider {
  channel: CommunicationChannel = 'EMAIL';
  displayName = 'Email';

  /** Platform SMTP from environment variables: only the Versaly workspace may use it. */
  private async platformSmtp(organizationId: string) {
    const host = await this.envFor(organizationId, process.env.SMTP_HOST);
    if (!host || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD || !process.env.SMTP_FROM) return null;
    return host;
  }

  async getConnectionStatus(organizationId: string): Promise<ChannelConnectionStatus> {
    const account = await this.getAccount(organizationId);
    const mailbox = await getWorkspaceMailbox(organizationId);
    const platform = await this.platformSmtp(organizationId);
    const connected = Boolean(mailbox || platform);
    const hasError = account?.status === 'ERROR';

    return {
      channel: this.channel,
      connected: Boolean(mailbox ? !hasError : platform),
      status: mailbox ? (hasError ? 'ERROR' : 'CONNECTED') : platform ? 'CONNECTED' : 'DISCONNECTED',
      displayName: this.displayName,
      accountName: account?.accountName || (platform ? 'Platform email' : undefined),
      accountHandle: mailbox?.address || account?.accountHandle || undefined,
      lastSyncAt: account?.lastSyncAt || null,
      errorMessage: hasError ? account?.errorMessage : connected ? undefined : 'Connect your email address to send and receive messages.',
      setupInstructions: 'Enter your email address and an app password. Versaly detects the mail servers automatically.',
      requiresCredentials: ['Email address', 'App password'],
    };
  }

  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    const { recipientAddress, subject, content, organizationId, senderName } = input;

    if (!recipientAddress || !/^\S+@\S+\.\S+$/.test(recipientAddress)) {
      return { success: false, deliveryStatus: 'FAILED', errorMessage: 'Invalid or missing recipient email address.' };
    }

    const mailbox = await getWorkspaceMailbox(organizationId);
    let transporter: nodemailer.Transporter;
    let fromAddress: string;
    let fromName: string | undefined;

    if (mailbox) {
      transporter = smtpTransport(mailbox.address, mailbox.password, mailbox.settings);
      fromAddress = mailbox.address;
      fromName = senderName ? `${senderName}` : mailbox.displayName;
    } else if (await this.platformSmtp(organizationId)) {
      const port = Number(process.env.SMTP_PORT || 587);
      const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
      });
      fromAddress = process.env.SMTP_FROM!;
    } else {
      return {
        success: false,
        deliveryStatus: 'FAILED',
        requiresConnection: true,
        errorMessage: 'Email is not connected. Connect your email address in the Inbox to send messages.',
      };
    }

    try {
      const inReplyTo = typeof input.metadata?.inReplyTo === 'string' ? input.metadata.inReplyTo : undefined;
      const info = await transporter.sendMail({
        from: fromName && mailbox ? { name: fromName, address: fromAddress } : fromAddress,
        to: recipientAddress,
        subject: subject || 'Message from your account manager',
        text: content,
        html: `<div style="font-family: sans-serif; line-height: 1.6; color: #1e293b;">${escapeHtml(content).replace(/\n/g, '<br/>')}</div>`,
        ...(inReplyTo ? { inReplyTo, references: [inReplyTo] } : {}),
      });
      return {
        success: true,
        deliveryStatus: 'SENT',
        externalMessageId: info.messageId,
        metadata: { messageId: info.messageId, accepted: info.accepted },
      };
    } catch (err: any) {
      console.error('EmailProvider sendMessage error:', err);
      return {
        success: false,
        deliveryStatus: 'FAILED',
        errorMessage: 'The email could not be sent. Check that your email connection is still valid.',
      };
    }
  }

  // Inbound email arrives through IMAP sync (lib/emailSync.ts). The webhook shape below is kept for
  // third-party inbound-parse services; the shared webhook handler authenticates it per workspace.
  async validateWebhook(): Promise<WebhookValidationResult> {
    return { isValid: false, error: 'Use the shared webhook handler.' };
  }

  async parseWebhookPayload(bodyText: string): Promise<InboundParsedMessage[]> {
    try {
      const data = JSON.parse(bodyText);
      const messages: InboundParsedMessage[] = [];
      if (data.From || data.sender || data.from) {
        const fromRaw = data.From || data.from || data.sender;
        const fromEmailMatch = String(fromRaw).match(/<([^>]+)>/) || [null, fromRaw];
        const fromEmail = fromEmailMatch[1]?.trim() || fromRaw;
        const text = data.TextBody || data.text || data.stripped_text || data.content || data.body || '';
        messages.push({
          channel: 'EMAIL',
          externalMessageId: data.MessageID || data.id || `em_${Date.now()}`,
          senderEmail: String(fromEmail).toLowerCase(),
          senderName: data.FromName || data.from_name || String(fromEmail).split('@')[0],
          content: text,
          sentAt: data.Date ? new Date(data.Date) : new Date(),
          metadata: { subject: data.Subject || data.subject },
        });
      }
      return messages;
    } catch {
      return [];
    }
  }
}
