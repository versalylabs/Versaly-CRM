import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import prisma from '@/lib/prisma';
import { recordInboundChannelMessage } from '@/lib/inbox';
import { readMailbox, smtpTransport, type MailServerSettings, type WorkspaceMailbox } from '@/lib/emailAccount';

const FIRST_SYNC_DAYS = 14;
const MAX_PER_SYNC = 40;

function imapClient(address: string, password: string, s: MailServerSettings) {
  return new ImapFlow({
    host: s.imapHost,
    port: s.imapPort,
    secure: s.imapSecure,
    auth: { user: s.username || address, pass: password },
    logger: false,
    socketTimeout: 20000,
  });
}

/** Verifies both IMAP and SMTP logins. Returns a human-readable error or null when OK. */
export async function testMailboxConnection(address: string, password: string, s: MailServerSettings): Promise<string | null> {
  try {
    const client = imapClient(address, password, s);
    await client.connect();
    await client.logout();
  } catch (e: any) {
    return explain('receiving (IMAP)', e);
  }
  try {
    await smtpTransport(address, password, s).verify();
  } catch (e: any) {
    return explain('sending (SMTP)', e);
  }
  return null;
}

function explain(what: string, e: any) {
  const msg = String(e?.responseText || e?.message || e);
  if (/auth|credential|login|password|invalid/i.test(msg)) {
    return `Could not sign in for ${what}. Check the address and use an app password (not your normal password) if your provider requires one.`;
  }
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(msg)) return `Could not find the mail server for ${what}. Check the address or enter the server details manually.`;
  if (/ETIMEDOUT|timeout|ECONNREFUSED/i.test(msg)) return `The mail server for ${what} did not respond. Check the server and port.`;
  return `Could not connect for ${what}: ${msg.slice(0, 160)}`;
}

/** Removes quoted history and signatures-of-replies so the thread shows only the new text. */
export function stripQuotedReply(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^On .+wrote:\s*$/i.test(line) || /^-{2,}\s*Original Message\s*-{2,}/i.test(line) || /^From:\s.+/.test(line) && /^Sent:|^Date:/i.test(lines[i + 1] || '')) break;
    if (/^On .+/.test(line) && /wrote:\s*$/i.test(lines[i + 1] || '')) break;
    if (/^>/.test(line)) continue;
    out.push(line);
  }
  const cleaned = out.join('\n').trim();
  return cleaned || text.trim();
}

function looksAutomated(parsed: any, fromAddress: string) {
  const h = parsed.headers;
  if (h?.get('list-unsubscribe') || h?.get('list-id')) return true;
  const precedence = String(h?.get('precedence') || '').toLowerCase();
  if (['bulk', 'list', 'junk'].includes(precedence)) return true;
  const auto = String(h?.get('auto-submitted') || '').toLowerCase();
  if (auto && auto !== 'no') return true;
  return /(^|[._-])(no-?reply|donotreply|mailer-daemon|postmaster)@/i.test(fromAddress);
}

export type SyncResult = { imported: number; skipped: number; error?: string };

export async function syncMailbox(box: WorkspaceMailbox): Promise<SyncResult> {
  const client = imapClient(box.address, box.password, box.settings);
  let imported = 0;
  let skipped = 0;
  let lastUid = box.lastUid;
  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const mailbox: any = client.mailbox;
      const validity = mailbox?.uidValidity ? String(mailbox.uidValidity) : null;
      if (box.uidValidity && validity && box.uidValidity !== validity) lastUid = 0; // mailbox was rebuilt

      let uids: number[] = [];
      if (lastUid > 0) {
        const found = await client.search({ uid: `${lastUid + 1}:*` }, { uid: true });
        uids = (found || []).filter((u) => u > lastUid);
      } else {
        const since = new Date(Date.now() - FIRST_SYNC_DAYS * 86400000);
        uids = (await client.search({ since }, { uid: true })) || [];
      }
      uids.sort((a, b) => a - b);
      // Incremental syncs take the OLDEST new messages first so the rest are picked up next time;
      // only the first sync (a "recent days" window) keeps just the newest ones.
      if (uids.length > MAX_PER_SYNC) uids = lastUid > 0 ? uids.slice(0, MAX_PER_SYNC) : uids.slice(-MAX_PER_SYNC);

      for (const uid of uids) {
        let parsed: Awaited<ReturnType<typeof simpleParser>>;
        try {
          const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
          if (!msg || !msg.source) {
            lastUid = Math.max(lastUid, uid);
            continue;
          }
          parsed = await simpleParser(msg.source);
        } catch (e) {
          // An unreadable message is skipped for good, so one bad email can't block the mailbox.
          console.warn('Email import skipped one unreadable message:', (e as Error).message);
          skipped++;
          lastUid = Math.max(lastUid, uid);
          continue;
        }
        try {
          const from = parsed.from?.value?.[0];
          const fromAddress = from?.address?.toLowerCase();
          if (!fromAddress || fromAddress === box.address.toLowerCase() || looksAutomated(parsed, fromAddress)) {
            skipped++;
          } else {
            const raw = parsed.text || (typeof parsed.html === 'string' ? parsed.html.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ') : '');
            const body = stripQuotedReply(raw || '').slice(0, 10000) || '(no text content)';
            await recordInboundChannelMessage({
              organizationId: box.organizationId,
              channel: 'EMAIL',
              content: body,
              externalMessageId: parsed.messageId || `imap:${box.accountId}:${validity}:${uid}`,
              senderEmail: fromAddress,
              senderName: from?.name || fromAddress.split('@')[0],
              metadata: {
                subject: parsed.subject || '',
                inReplyTo: parsed.inReplyTo || null,
                references: parsed.references || null,
                messageId: parsed.messageId || null,
              },
            });
            imported++;
          }
        } catch (e) {
          // Saving failed (e.g. database error): stop here without moving the bookmark, so this
          // message and the ones after it are retried on the next sync instead of being lost.
          console.error('Email import failed; will retry next sync:', (e as Error).message);
          break;
        }
        lastUid = Math.max(lastUid, uid);
      }
      if (!uids.length && lastUid === 0) {
        // Nothing in the window: remember the highest UID so later syncs only look forward.
        const status = await client.status('INBOX', { uidNext: true });
        lastUid = Math.max(0, ((status && status.uidNext) || 1) - 1);
      }

      await prisma.connectedChannelAccount.update({
        where: { id: box.accountId },
        data: {
          status: 'CONNECTED',
          errorMessage: null,
          lastSyncAt: new Date(),
          metadata: await mergedMeta(box.accountId, { lastUid, uidValidity: validity }),
        },
      });
    } finally {
      lock.release();
    }
    await client.logout();
    return { imported, skipped };
  } catch (e: any) {
    try { await client.logout(); } catch { /* ignore */ }
    const message = explain('receiving (IMAP)', e);
    await prisma.connectedChannelAccount.update({ where: { id: box.accountId }, data: { status: 'ERROR', errorMessage: message } }).catch(() => {});
    return { imported, skipped, error: message };
  }
}

async function mergedMeta(accountId: string, patch: Record<string, unknown>) {
  const row = await prisma.connectedChannelAccount.findUnique({ where: { id: accountId }, select: { metadata: true } });
  return { ...((row?.metadata as any) || {}), ...patch } as any;
}

/** Sync a workspace's mailbox unless it was synced very recently. */
export async function syncWorkspaceMailbox(organizationId: string, opts: { minIntervalMs?: number } = {}): Promise<SyncResult & { connected: boolean; throttled?: boolean }> {
  const account = await prisma.connectedChannelAccount.findFirst({
    where: { organizationId, channel: 'EMAIL' },
    orderBy: { updatedAt: 'desc' },
  });
  const box = account ? readMailbox(account) : null;
  if (!account || !box) return { connected: false, imported: 0, skipped: 0 };
  const min = opts.minIntervalMs ?? 45000;
  if (account.lastSyncAt && Date.now() - account.lastSyncAt.getTime() < min && account.status === 'CONNECTED') {
    return { connected: true, imported: 0, skipped: 0, throttled: true };
  }
  return { connected: true, ...(await syncMailbox(box)) };
}

export async function syncAllMailboxes() {
  // Mailboxes in ERROR (e.g. a changed password) are skipped here; opening the inbox retries them.
  const accounts = await prisma.connectedChannelAccount.findMany({ where: { channel: 'EMAIL', status: 'CONNECTED' } });
  const boxes = accounts.map(readMailbox).filter((b): b is WorkspaceMailbox => Boolean(b));
  let imported = 0;
  // A few at a time, so many workspaces still fit inside the cron function's time limit.
  for (let i = 0; i < boxes.length; i += 5) {
    const results = await Promise.all(boxes.slice(i, i + 5).map(syncMailbox));
    imported += results.reduce((sum, r) => sum + r.imported, 0);
  }
  return { accounts: boxes.length, imported };
}
