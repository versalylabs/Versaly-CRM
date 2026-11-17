import prisma from '@/lib/prisma';
import nodemailer from 'nodemailer';
import { decryptSecret } from '@/lib/secretBox';

/**
 * A workspace's own mailbox (IMAP to receive, SMTP to send).
 * Stored in ConnectedChannelAccount (channel EMAIL): the address is accountHandle,
 * the (encrypted) password is accessToken, and server settings live in metadata.
 */
export type MailServerSettings = {
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean; // true = implicit TLS (465); false = STARTTLS (587)
  username?: string;
};

export type WorkspaceMailbox = {
  accountId: string;
  organizationId: string;
  address: string;
  password: string;
  displayName: string;
  settings: MailServerSettings;
  lastUid: number;
  uidValidity: string | null;
};

/** Best-effort server presets so owners only enter an address and an app password. */
export function guessMailSettings(address: string): MailServerSettings {
  const domain = address.split('@')[1]?.toLowerCase() || '';
  const presets: Record<string, MailServerSettings> = {
    gmail: { imapHost: 'imap.gmail.com', imapPort: 993, imapSecure: true, smtpHost: 'smtp.gmail.com', smtpPort: 465, smtpSecure: true },
    outlook: { imapHost: 'outlook.office365.com', imapPort: 993, imapSecure: true, smtpHost: 'smtp.office365.com', smtpPort: 587, smtpSecure: false },
    yahoo: { imapHost: 'imap.mail.yahoo.com', imapPort: 993, imapSecure: true, smtpHost: 'smtp.mail.yahoo.com', smtpPort: 465, smtpSecure: true },
    zoho: { imapHost: 'imap.zoho.com', imapPort: 993, imapSecure: true, smtpHost: 'smtp.zoho.com', smtpPort: 465, smtpSecure: true },
    icloud: { imapHost: 'imap.mail.me.com', imapPort: 993, imapSecure: true, smtpHost: 'smtp.mail.me.com', smtpPort: 587, smtpSecure: false },
  };
  if (domain === 'gmail.com' || domain === 'googlemail.com') return presets.gmail;
  if (['outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'office365.com'].includes(domain)) return presets.outlook;
  if (domain.startsWith('yahoo.')) return presets.yahoo;
  if (domain.startsWith('zoho.')) return presets.zoho;
  if (['icloud.com', 'me.com', 'mac.com'].includes(domain)) return presets.icloud;
  // Unknown provider (e.g. a company domain): the usual convention.
  return { imapHost: `imap.${domain}`, imapPort: 993, imapSecure: true, smtpHost: `smtp.${domain}`, smtpPort: 465, smtpSecure: true };
}

export function readMailbox(account: {
  id: string;
  organizationId: string;
  accountHandle: string;
  accountName: string;
  accessToken: string | null;
  metadata: unknown;
}): WorkspaceMailbox | null {
  const meta = (account.metadata || {}) as any;
  const password = decryptSecret(account.accessToken);
  if (!password || !meta.imapHost || !meta.smtpHost) return null;
  return {
    accountId: account.id,
    organizationId: account.organizationId,
    address: account.accountHandle.replace(/^@/, ''),
    password,
    displayName: account.accountName,
    settings: {
      imapHost: meta.imapHost,
      imapPort: Number(meta.imapPort) || 993,
      imapSecure: meta.imapSecure !== false,
      smtpHost: meta.smtpHost,
      smtpPort: Number(meta.smtpPort) || 465,
      smtpSecure: meta.smtpSecure !== false,
      username: meta.username || undefined,
    },
    lastUid: Number(meta.lastUid) || 0,
    uidValidity: meta.uidValidity ? String(meta.uidValidity) : null,
  };
}

export async function getWorkspaceMailbox(organizationId: string): Promise<WorkspaceMailbox | null> {
  const account = await prisma.connectedChannelAccount.findFirst({
    where: { organizationId, channel: 'EMAIL', status: { in: ['CONNECTED', 'ERROR'] } },
    orderBy: { updatedAt: 'desc' },
  });
  return account ? readMailbox(account) : null;
}

export function smtpTransport(address: string, password: string, s: MailServerSettings) {
  return nodemailer.createTransport({
    host: s.smtpHost,
    port: s.smtpPort,
    secure: s.smtpSecure,
    auth: { user: s.username || address, pass: password },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
  });
}
