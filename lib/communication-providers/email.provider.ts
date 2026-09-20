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
import prisma from '@/lib/prisma';

export class EmailProvider extends BaseCommunicationProvider {
  channel: CommunicationChannel = 'EMAIL';
  displayName = 'Email (SMTP / Inbound)';

  private isSmtpConfigured(): boolean {
    return Boolean(
      process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASSWORD &&
      process.env.SMTP_FROM
    );
  }

  async getConnectionStatus(organizationId: string): Promise<ChannelConnectionStatus> {
    const account = await this.getAccount(organizationId);
    const hasEnvConfig = this.isSmtpConfigured();
    const isConnected = Boolean(hasEnvConfig || (account && account.status === 'CONNECTED'));

    return {
      channel: this.channel,
      connected: isConnected,
      status: isConnected ? 'CONNECTED' : 'DISCONNECTED',
      displayName: this.displayName,
      accountName: account?.accountName || (hasEnvConfig ? 'System SMTP Gateway' : undefined),
      accountHandle: account?.accountHandle || process.env.SMTP_FROM || undefined,
      lastSyncAt: account?.lastSyncAt || (isConnected ? new Date() : null),
      errorMessage: isConnected ? undefined : 'SMTP server settings (SMTP_HOST, SMTP_USER, SMTP_PASSWORD, SMTP_FROM) are not configured.',
      setupInstructions: 'Configure SMTP credentials in your workspace settings or environment variables to dispatch live emails directly to leads.',
      requiresCredentials: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM'],
    };
  }

  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    const { recipientAddress, subject, content, organizationId, senderName } = input;

    if (!recipientAddress || !/^\S+@\S+\.\S+$/.test(recipientAddress)) {
      return {
        success: false,
        deliveryStatus: 'FAILED',
        errorMessage: 'Invalid or missing recipient email address.',
      };
    }

    if (!this.isSmtpConfigured()) {
      return {
        success: false,
        deliveryStatus: 'FAILED',
        errorMessage: 'Email channel is not connected. SMTP credentials (host, user, password, from) are required for live email delivery.',
        requiresConnection: true,
      };
    }

    try {
      const port = Number(process.env.SMTP_PORT || 587);
      const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;

      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
      });

      const emailSubject = subject || 'Update regarding your account';
      const fromAddress = process.env.SMTP_FROM!;

      const info = await transporter.sendMail({
        from: senderName ? `"${senderName}" <${fromAddress}>` : fromAddress,
        to: recipientAddress,
        subject: emailSubject,
        text: content,
        html: `<div style="font-family: sans-serif; line-height: 1.6; color: #1e293b;">${content.replace(/\n/g, '<br/>')}</div>`,
      });

      return {
        success: true,
        deliveryStatus: 'SENT',
        externalMessageId: info.messageId,
        metadata: {
          messageId: info.messageId,
          response: info.response,
          accepted: info.accepted,
        },
      };
    } catch (err: any) {
      console.error('EmailProvider sendMessage error:', err);
      return {
        success: false,
        deliveryStatus: 'FAILED',
        errorMessage: err.message || 'Failed to dispatch email via SMTP server',
      };
    }
  }

  async validateWebhook(request: Request, bodyText: string): Promise<WebhookValidationResult> {
    // Inbound email webhooks can validate token header if configured
    const apiKey = request.headers.get('x-webhook-secret');
    if (process.env.EMAIL_WEBHOOK_SECRET && apiKey !== process.env.EMAIL_WEBHOOK_SECRET) {
      return { isValid: false, error: 'Invalid email webhook secret' };
    }
    return { isValid: true };
  }

  async parseWebhookPayload(bodyText: string): Promise<InboundParsedMessage[]> {
    try {
      const data = JSON.parse(bodyText);
      const messages: InboundParsedMessage[] = [];

      // Handle common formats: Postmark, SendGrid Inbound Parse, Mailgun, or standard CRM format
      if (data.From || data.sender || data.from) {
        const fromRaw = data.From || data.from || data.sender;
        const fromEmailMatch = String(fromRaw).match(/<([^>]+)>/) || [null, fromRaw];
        const fromEmail = fromEmailMatch[1]?.trim() || fromRaw;
        const text = data.TextBody || data.text || data.stripped_text || data.content || data.body || '';

        messages.push({
          channel: 'EMAIL',
          externalMessageId: data.MessageID || data.id || `em_${Date.now()}`,
          senderEmail: fromEmail,
          senderName: data.FromName || data.from_name || fromEmail.split('@')[0],
          content: text,
          sentAt: data.Date ? new Date(data.Date) : new Date(),
          metadata: {
            subject: data.Subject || data.subject,
            headers: data.Headers,
          },
        });
      }

      return messages;
    } catch (err) {
      return [];
    }
  }
}
